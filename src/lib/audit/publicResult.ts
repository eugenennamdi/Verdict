import type { RunVerdictAuditResult } from "@/lib/audit/runVerdictAudit";

export function summarizeVerdictAuditResult(result: RunVerdictAuditResult) {
  return {
    reportId: result.reportId,
    overallScore: result.overallScore,
    identity: result.identity,
    pagesInspected: result.pagesInspected,
    pagesAccepted: result.pagesAccepted,
    evidence: result.evidence,
    evidenceCoverage: result.evidenceCoverage,
    finalCoverage: result.finalCoverage,
    budgetUsage: result.budgetUsage,
    stopReason: result.stopReason,
    investigation: result.investigation,
    company_name: result.audit.company_name || result.identity.company_name,
    score_interpretation: result.audit.score_interpretation,
    the_verdict: result.audit.the_verdict,
    priority_matrix: result.audit.priority_matrix,
    pillars: result.audit.pillars,
  };
}
