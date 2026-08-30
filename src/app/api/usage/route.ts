export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousAuditVisitor,
  type AnonymousAuditVisitor,
} from "@/lib/humanAuditIdentity";
import { getHumanAuditUsage } from "@/lib/humanAuditAccess";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

type UsageDependencies = {
  resolveVisitor?: (request: Request) => AnonymousAuditVisitor;
  getUsage?: (identity: string) => Promise<HumanAuditUsageState>;
};

export function createUsageHandler(dependencies: UsageDependencies = {}) {
  const resolveVisitor =
    dependencies.resolveVisitor ?? resolveAnonymousAuditVisitor;
  const getUsage = dependencies.getUsage ?? getHumanAuditUsage;

  return async function handleUsage(request: Request): Promise<Response> {
    try {
      const visitor = resolveVisitor(request);
      const usage = await getUsage(visitor.quotaIdentity);
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
