export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousAuditVisitor,
  type AnonymousAuditVisitor,
} from "@/lib/humanAuditIdentity";
import { getHumanAuditQuota } from "@/lib/humanAuditQuota";
import type { HumanAuditQuotaState } from "@/lib/humanAuditQuotaContract";

type UsageDependencies = {
  resolveVisitor?: (request: Request) => AnonymousAuditVisitor;
  getQuota?: (identity: string) => Promise<HumanAuditQuotaState>;
};

export function createUsageHandler(dependencies: UsageDependencies = {}) {
  const resolveVisitor =
    dependencies.resolveVisitor ?? resolveAnonymousAuditVisitor;
  const getQuota = dependencies.getQuota ?? getHumanAuditQuota;

  return async function handleUsage(request: Request): Promise<Response> {
    try {
      const visitor = resolveVisitor(request);
      const quota = await getQuota(visitor.quotaIdentity);
      return attachAnonymousVisitorCookie(
        NextResponse.json(quota, {
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
