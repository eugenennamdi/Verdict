export const dynamic = "force-dynamic";

import type { FacilitatorClient, SettleResultContext } from "@x402/core/server";
import { NextRequest, NextResponse } from "next/server";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousAuditVisitor,
  type AnonymousAuditVisitor,
} from "@/lib/humanAuditIdentity";
import { getHumanAuditUsage } from "@/lib/humanAuditAccess";
import { recordSettledHumanAuditEntitlement } from "@/lib/humanAuditEntitlement";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import {
  loadVerdictX402Config,
  protectVerdictHumanEntitlementRoute,
  VerdictX402ConfigurationError,
  type VerdictX402Config,
} from "@/lib/x402/server";

type EntitlementRouteDependencies = {
  resolveVisitor?: (request: Request) => AnonymousAuditVisitor;
  getUsage?: (visitorHash: string) => Promise<HumanAuditUsageState>;
  recordSettlement?: (
    visitorHash: string,
    context: SettleResultContext
  ) => Promise<void>;
  facilitator?: FacilitatorClient;
  syncFacilitatorOnStart?: boolean;
};

function safeError(status: number, code: string): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

function settlementRequest(context: SettleResultContext): Request {
  const transport = context.transportContext as
    | {
        request?: {
          adapter?: {
            getHeader(name: string): string | undefined;
            getUrl(): string;
          };
        };
      }
    | undefined;
  const adapter = transport?.request?.adapter;
  if (!adapter) throw new Error("Human entitlement request context is missing");
  const headers = new Headers();
  const cookie = adapter.getHeader("cookie");
  if (cookie) headers.set("cookie", cookie);
  return new Request(adapter.getUrl(), { method: "POST", headers });
}

export function createHumanAuditEntitlementHandler(
  config: VerdictX402Config,
  dependencies: EntitlementRouteDependencies = {}
): (request: NextRequest) => Promise<NextResponse> {
  const resolveVisitor =
    dependencies.resolveVisitor ?? resolveAnonymousAuditVisitor;
  const getUsage = dependencies.getUsage ?? getHumanAuditUsage;
  const recordSettlement =
    dependencies.recordSettlement ??
    (async (visitorHash: string, context: SettleResultContext) => {
      await recordSettledHumanAuditEntitlement(
        visitorHash,
        context.result,
        context.requirements
      );
    });

  const authorized = async (request: NextRequest): Promise<NextResponse> => {
    const visitor = resolveVisitor(request);
    if (visitor.setCookieHeader) {
      return safeError(409, "HUMAN_AUDIT_VISITOR_COOKIE_REQUIRED");
    }
    const usage = await getUsage(visitor.quotaIdentity);
    return NextResponse.json(
      {
        entitlement: { available: usage.paid.available },
        usage,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  };

  const paid = protectVerdictHumanEntitlementRoute(
    authorized,
    config,
    async (context) => {
      const visitor = resolveVisitor(settlementRequest(context));
      if (visitor.setCookieHeader) {
        throw new Error("Human audit payment is missing a valid visitor cookie");
      }
      await recordSettlement(visitor.quotaIdentity, context);
    },
    {
      facilitator: dependencies.facilitator,
      syncFacilitatorOnStart: dependencies.syncFacilitatorOnStart,
    }
  );

  return async (request: NextRequest): Promise<NextResponse> => {
    let visitor: AnonymousAuditVisitor;
    try {
      visitor = resolveVisitor(request);
    } catch {
      return safeError(503, "HUMAN_AUDIT_ENTITLEMENT_UNAVAILABLE");
    }

    const hasPayment =
      request.headers.has("payment-signature") ||
      request.headers.has("x-payment");
    if (hasPayment && visitor.setCookieHeader) {
      return attachAnonymousVisitorCookie(
        safeError(409, "HUMAN_AUDIT_VISITOR_COOKIE_REQUIRED"),
        visitor
      );
    }

    try {
      return attachAnonymousVisitorCookie(await paid(request), visitor);
    } catch (error: unknown) {
      if (error instanceof VerdictX402ConfigurationError) {
        return safeError(500, "X402_CONFIGURATION_ERROR");
      }
      console.error("[human-audit-entitlement] Payment flow failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return attachAnonymousVisitorCookie(
        safeError(503, "HUMAN_AUDIT_ENTITLEMENT_UNAVAILABLE"),
        visitor
      );
    }
  };
}

let cachedHandler:
  | {
      key: string;
      handler: (request: NextRequest) => Promise<NextResponse>;
    }
  | undefined;

function productionHandler(): (request: NextRequest) => Promise<NextResponse> {
  const config = loadVerdictX402Config();
  const key = [
    config.network,
    config.price,
    config.payTo,
    config.facilitatorUrl,
  ].join("|");
  if (!cachedHandler || cachedHandler.key !== key) {
    cachedHandler = {
      key,
      handler: createHumanAuditEntitlementHandler(config),
    };
  }
  return cachedHandler.handler;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await productionHandler()(request);
  } catch (error: unknown) {
    if (error instanceof VerdictX402ConfigurationError) {
      return safeError(500, "X402_CONFIGURATION_ERROR");
    }
    throw error;
  }
}
