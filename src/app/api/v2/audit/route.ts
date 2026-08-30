export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { summarizeVerdictAuditResult } from "@/lib/audit/publicResult";
import {
  runVerdictAudit,
  type RunVerdictAuditResult,
} from "@/lib/audit/runVerdictAudit";
import { ScrapingError } from "@/lib/engine";
import { isSanitizedModelAvailabilityError } from "@/lib/audit/publicError";
import {
  parseAndAssertHttpUrl,
  UnsafeUrlError,
} from "@/lib/security/url";
import {
  loadVerdictX402Config,
  protectVerdictAuditRoute,
  VerdictX402ConfigurationError,
  type VerdictX402Config,
} from "@/lib/x402/server";

type AuditRunner = (input: {
  url: string;
  persist: true;
}) => Promise<RunVerdictAuditResult>;

type AuditRouteDependencies = {
  runAudit?: AuditRunner;
  summarize?: typeof summarizeVerdictAuditResult;
};

function errorResponse(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function parseRequestBody(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new UnsafeUrlError("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "url") {
    throw new UnsafeUrlError(
      'Request body must contain exactly one field: "url"'
    );
  }
  if (typeof record.url !== "string" || !record.url.trim()) {
    throw new UnsafeUrlError("URL is required");
  }

  return parseAndAssertHttpUrl(record.url.trim()).href;
}

export function createAuthorizedAuditHandler(
  dependencies: AuditRouteDependencies = {}
): (request: NextRequest) => Promise<NextResponse> {
  const audit = dependencies.runAudit ?? runVerdictAudit;
  const summarize = dependencies.summarize ?? summarizeVerdictAuditResult;

  return async (request: NextRequest): Promise<NextResponse> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "Invalid JSON body");
    }

    let url: string;
    try {
      url = parseRequestBody(body);
    } catch (error: unknown) {
      const message =
        error instanceof UnsafeUrlError ? error.message : "Invalid request";
      return errorResponse(400, "INVALID_URL", message);
    }

    try {
      const result = await audit({ url, persist: true });
      return NextResponse.json(summarize(result));
    } catch (error: unknown) {
      if (error instanceof UnsafeUrlError) {
        return errorResponse(400, "INVALID_URL", "The URL is not auditable");
      }
      if (error instanceof ScrapingError) {
        return errorResponse(
          422,
          "AUDIT_UNAVAILABLE",
          "The startup could not be audited"
        );
      }
      if (isSanitizedModelAvailabilityError(error)) {
        return errorResponse(
          503,
          "AUDIT_TEMPORARILY_UNAVAILABLE",
          "The audit service is temporarily unavailable"
        );
      }

      console.error("[api/v2/audit] Audit failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return errorResponse(
        500,
        "AUDIT_FAILED",
        "The audit could not be completed"
      );
    }
  };
}

const authorizedHandler = createAuthorizedAuditHandler();
let cachedPaidHandler:
  | {
      key: string;
      handler: (request: NextRequest) => Promise<NextResponse>;
    }
  | undefined;

function configCacheKey(config: VerdictX402Config): string {
  return [
    config.network,
    config.price,
    config.payTo,
    config.facilitatorUrl,
  ].join("|");
}

function getPaidHandler(): (request: NextRequest) => Promise<NextResponse> {
  const config = loadVerdictX402Config();
  const key = configCacheKey(config);
  if (!cachedPaidHandler || cachedPaidHandler.key !== key) {
    cachedPaidHandler = {
      key,
      handler: protectVerdictAuditRoute(authorizedHandler, config),
    };
  }
  return cachedPaidHandler.handler;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await getPaidHandler()(request);
  } catch (error: unknown) {
    if (error instanceof VerdictX402ConfigurationError) {
      return errorResponse(500, "X402_CONFIGURATION_ERROR", error.message);
    }
    throw error;
  }
}
