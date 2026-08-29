export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { runVerdictAudit } from "@/lib/audit/runVerdictAudit";
import type { ActivityEvent } from "@/lib/audit/events";
import { redis } from "@/lib/redis";
import { ScrapingError } from "@/lib/engine";

const RATE_LIMIT_SECONDS = 43200;
const RATE_LIMIT_PREFIX = "rate_limit_demo:";

type StreamFrame =
  | { kind: "event"; event: ActivityEvent }
  | { kind: "result"; result: Record<string, unknown> }
  | { kind: "error"; error: string };

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "127.0.0.1";
}

function isLocalClient(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

function sseFrame(payload: StreamFrame): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function summarizeResult(result: Awaited<ReturnType<typeof runVerdictAudit>>) {
  return {
    reportId: result.reportId,
    overallScore: result.overallScore,
    identity: result.identity,
    evidence: result.evidence,
    evidenceCoverage: result.evidenceCoverage,
    investigation: result.investigation,
    company_name: result.audit.company_name || result.identity.company_name,
    score_interpretation: result.audit.score_interpretation,
    the_verdict: result.audit.the_verdict,
    priority_matrix: result.audit.priority_matrix,
    pillars: result.audit.pillars,
  };
}

export async function POST(req: Request) {
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

  const ip = clientIp(req);
  const rateLimitKey = `${RATE_LIMIT_PREFIX}${ip}`;

  if (!isLocalClient(ip)) {
    const lastAudit = await redis.get(rateLimitKey);
    if (lastAudit) {
      let retryAfterSeconds: number | undefined;
      try {
        const ttl = await redis.ttl(rateLimitKey);
        if (typeof ttl === "number" && ttl > 0) retryAfterSeconds = ttl;
      } catch {
        retryAfterSeconds = undefined;
      }
      return NextResponse.json(
        { error: "RATE_LIMIT_EXCEEDED", retryAfterSeconds },
        { status: 429 }
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: StreamFrame) => controller.enqueue(sseFrame(payload));
      try {
        const result = await runVerdictAudit({
          url,
          persist: true,
          onEvent: (event) => {
            send({ kind: "event", event });
          },
        });

        if (!isLocalClient(ip)) {
          await redis.set(rateLimitKey, Date.now(), "EX", RATE_LIMIT_SECONDS);
        }

        send({ kind: "result", result: summarizeResult(result) });
        controller.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const name = error instanceof Error ? error.name : "";
        if (!(error instanceof ScrapingError) && name !== "UnsafeUrlError") {
          console.error("Investigate Error:", error);
        }
        send({ kind: "error", error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
