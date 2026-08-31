export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousAuditVisitor,
  type AnonymousAuditVisitor,
} from "@/lib/humanAuditIdentity";
import { getHumanAuditUsage } from "@/lib/humanAuditAccess";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

export const USAGE_READ_TIMEOUT_MS = 1_500;

type UsageDependencies = {
  resolveVisitor?: (request: Request) => AnonymousAuditVisitor;
  getUsage?: (identity: string) => Promise<HumanAuditUsageState>;
  timeoutMs?: number;
};

async function readUsageWithinTimeout(
  readUsage: () => Promise<HumanAuditUsageState>,
  timeoutMs: number
): Promise<HumanAuditUsageState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("HUMAN_AUDIT_USAGE_TIMEOUT")),
      timeoutMs
    );
  });

  try {
    return await Promise.race([readUsage(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createUsageHandler(dependencies: UsageDependencies = {}) {
  const resolveVisitor =
    dependencies.resolveVisitor ?? resolveAnonymousAuditVisitor;
  const getUsage = dependencies.getUsage ?? getHumanAuditUsage;
  const timeoutMs = dependencies.timeoutMs ?? USAGE_READ_TIMEOUT_MS;

  return async function handleUsage(request: Request): Promise<Response> {
    try {
      const visitor = resolveVisitor(request);
      const usage = await readUsageWithinTimeout(
        () => getUsage(visitor.quotaIdentity),
        timeoutMs
      );
      return attachAnonymousVisitorCookie(
        NextResponse.json(usage, {
          headers: { "Cache-Control": "private, no-store" },
        }),
        visitor
      );
    } catch {
      return NextResponse.json(
        { error: "HUMAN_AUDIT_QUOTA_UNAVAILABLE" },
        { status: 503 }
      );
    }
  };
}

const usageHandler = createUsageHandler();

export async function GET(request: Request): Promise<Response> {
  return usageHandler(request);
}
