import type { EvidenceCategory } from "@/lib/audit/evidence";
import type { RunVerdictAuditResult } from "@/lib/audit/runVerdictAudit";

export type PublicPillar = {
  confidence?: string;
  reason?: string;
  strengths?: string[];
  weaknesses?: string[];
};

export type PublicAuditSource = {
  url: string;
  path: string;
  role: "homepage" | "supporting";
  category?: EvidenceCategory;
  keyFindings?: string[];
};

function toPublicPillars(
  pillars: Record<string, unknown> | undefined
): Record<string, PublicPillar> {
  if (!pillars || typeof pillars !== "object") return {};
  const projected: Record<string, PublicPillar> = {};
  for (const [key, raw] of Object.entries(pillars)) {
    if (!raw || typeof raw !== "object") continue;
    const val = raw as Record<string, unknown>;
    projected[key] = {
      ...(typeof val.confidence === "string" ? { confidence: val.confidence } : {}),
      ...(typeof val.reason === "string" ? { reason: val.reason } : {}),
      ...(Array.isArray(val.strengths) ? { strengths: [...val.strengths] } : {}),
      ...(Array.isArray(val.weaknesses) ? { weaknesses: [...val.weaknesses] } : {}),
    };
  }
  return projected;
}

function toPublicSources(result: RunVerdictAuditResult): PublicAuditSource[] {
  if (
    Array.isArray(result.auditContext?.sources) &&
    result.auditContext.sources.length > 0
  ) {
    return result.auditContext.sources.map((source) => ({
      url: source.url,
      path: source.path,
      role: source.role,
      ...(source.category ? { category: source.category } : {}),
      ...(source.keyFindings && source.keyFindings.length > 0
        ? { keyFindings: [...source.keyFindings] }
        : {}),
    }));
  }
  if (Array.isArray(result.evidence) && result.evidence.length > 0) {
    return result.evidence
      .filter((page) => page.status === "acquired")
      .map((page) => ({
        url: page.url,
        path: page.path,
        role: page.role,
        ...(page.category ? { category: page.category } : {}),
      }));
  }
  return [];
}

export function summarizeVerdictAuditResult(result: RunVerdictAuditResult) {
  return {
    reportId: result.reportId,
    overallScore: result.overallScore,
    company_name: result.audit.company_name || result.identity.company_name,
    identity: result.identity,
    the_verdict: result.audit.the_verdict,
    score_interpretation: result.audit.score_interpretation,
    priority_matrix: result.audit.priority_matrix,
    pillars: toPublicPillars(result.audit.pillars as Record<string, unknown>),
    sources: toPublicSources(result),
    pagesInspected: result.pagesInspected,
    pagesAccepted: result.pagesAccepted,
    stopReason: result.stopReason,
    evidenceCoverage: result.evidenceCoverage,
  };
}
