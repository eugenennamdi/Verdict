export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/dist/server/web/spec-extension/response";
import {
  runVerdictAudit,
  type RunVerdictAuditResult,
} from "@/lib/audit/runVerdictAudit";
import { summarizeVerdictAuditResult } from "@/lib/audit/publicResult";
import type { ActivityEvent } from "@/lib/audit/events";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousAuditVisitor,
  type AnonymousAuditVisitor,
} from "@/lib/humanAuditIdentity";
import {
  completeHumanAuditAccess,
  releaseHumanAuditAccess,
  reserveHumanAuditAccess,
  type HumanAuditAccessDecision,
  type HumanAuditReservedAccess,
} from "@/lib/humanAuditAccess";
import { humanAuditQuotaExhaustedMessage } from "@/lib/humanAuditQuotaContract";
import { redis } from "@/lib/redis";
import { ScrapingError } from "@/lib/engine";

const ABUSE_RATE_LIMIT = 10;
const ABUSE_RATE_WINDOW_SECONDS = 10 * 60;
const ABUSE_RATE_PREFIX = "human_audit_abuse:";

type StreamFrame =
  | { kind: "event"; event: ActivityEvent }
  | { kind: "result"; result: Record<string, unknown> }
  | { kind: "error"; error: string };

type AbuseDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type InvestigateDependencies = {
  runAudit?: typeof runVerdictAudit;
  summarize?: (result: RunVerdictAuditResult) => Record<string, unknown>;
  resolveVisitor?: (request: Request) => AnonymousAuditVisitor;
  reserveAccess?: (identity: string) => Promise<HumanAuditAccessDecision>;
  completeAccess?: typeof completeHumanAuditAccess;
  releaseAccess?: typeof releaseHumanAuditAccess;
  checkAbuse?: (request: Request) => Promise<AbuseDecision>;
};

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "127.0.0.1";
}

function isLocalClient(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

async function checkAuditAbuseLimit(req: Request): Promise<AbuseDecision> {
  const ip = clientIp(req);
  if (isLocalClient(ip)) return { allowed: true };

  try {
    const key = `${ABUSE_RATE_PREFIX}${ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ABUSE_RATE_WINDOW_SECONDS);
    }
    if (typeof count === "number" && count > ABUSE_RATE_LIMIT) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        ...(typeof ttl === "number" && ttl > 0
          ? { retryAfterSeconds: ttl }
          : {}),
      };
    }
  } catch {
    // Product quota remains authoritative if abuse-limiter telemetry is down.
  }
  return { allowed: true };
}

function sseFrame(payload: StreamFrame): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createInvestigateHandler(
  dependencies: InvestigateDependencies = {}
) {
  const runAudit = dependencies.runAudit ?? runVerdictAudit;
  const summarize = dependencies.summarize ?? summarizeVerdictAuditResult;
  const resolveVisitor =
    dependencies.resolveVisitor ?? resolveAnonymousAuditVisitor;
  const reserveAccess = dependencies.reserveAccess ?? reserveHumanAuditAccess;
  const completeAccess =
    dependencies.completeAccess ?? completeHumanAuditAccess;
  const releaseAccess = dependencies.releaseAccess ?? releaseHumanAuditAccess;
  const checkAbuse = dependencies.checkAbuse ?? checkAuditAbuseLimit;

  return async function handleInvestigate(req: Request): Promise<Response> {
    let url: string | undefined;
    try {
      const body = await req.json();
      url = typeof body?.url === "string" ? body.url : undefined;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let visitor: AnonymousAuditVisitor;
    try {
      visitor = resolveVisitor(req);
    } catch {
      return NextResponse.json(
        { error: "HUMAN_AUDIT_QUOTA_UNAVAILABLE" },
        { status: 503 }
      );
    }

    const abuse = await checkAbuse(req);
    if (!abuse.allowed) {
      return attachAnonymousVisitorCookie(
        NextResponse.json(
          {
            error: "ABUSE_RATE_LIMIT_EXCEEDED",
            retryAfterSeconds: abuse.retryAfterSeconds,
          },
          { status: 429 }
        ),
        visitor
      );
    }

    let access: HumanAuditAccessDecision;
    try {
      access = await reserveAccess(visitor.quotaIdentity);
    } catch {
      return attachAnonymousVisitorCookie(
        NextResponse.json(
          { error: "HUMAN_AUDIT_QUOTA_UNAVAILABLE" },
          { status: 503 }
        ),
        visitor
      );
    }

    if (!access.allowed) {
      return attachAnonymousVisitorCookie(
        NextResponse.json(
          {
            error: "HUMAN_AUDIT_PAYMENT_REQUIRED",
            message: humanAuditQuotaExhaustedMessage(access.usage.free),
            quota: access.usage.free,
            usage: access.usage,
          },
          { status: 429 }
        ),
        visitor
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: StreamFrame) =>
          controller.enqueue(sseFrame(payload));
        let committed = false;
        const reservedAccess: HumanAuditReservedAccess = access.access;
        try {
          const result = await runAudit({
            url,
            persist: process.env.VERDICT_DISABLE_AUDIT_PERSISTENCE !== "true",
            onEvent: (event) => {
              send({ kind: "event", event });
            },
          });

          const usage = await completeAccess(
            visitor.quotaIdentity,
            reservedAccess,
            result.reportId
          );
          committed = true;
          send({
            kind: "result",
            result: {
              ...summarize(result),
              humanAuditQuota: usage.free,
              humanAuditUsage: usage,
            },
          });
          controller.close();
        } catch (error: unknown) {
          if (!committed) {
            try {
              await releaseAccess(
                visitor.quotaIdentity,
                reservedAccess
              );
            } catch {
              console.error("Human audit quota reservation release failed");
            }
          }
          const message = error instanceof Error ? error.message : String(error);
          const name = error instanceof Error ? error.name : "";
          if (!(error instanceof ScrapingError) && name !== "UnsafeUrlError") {
            console.error("Investigate Error:", error);
          }
          try {
            send({ kind: "error", error: message });
            controller.close();
          } catch {
            // The client disconnected. Completed work was already committed;
            // incomplete work was released above.
          }
        }
      },
    });

    return attachAnonymousVisitorCookie(
      new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      }),
      visitor
    );
  };
}

const investigateHandler = createInvestigateHandler();

export async function POST(req: Request) {
  return investigateHandler(req);
}
