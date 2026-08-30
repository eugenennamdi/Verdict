import { describe, expect, it } from "vitest";
import type { RunVerdictAuditResult } from "./runVerdictAudit";
import { summarizeVerdictAuditResult } from "./publicResult";

describe("public audit result", () => {
  it("adds Phase 3 metadata to the final SSE result contract", () => {
    const result = {
      reportId: "report-1",
      overallScore: 71,
      identity: {
        company_name: "Example",
        inferred_description: "Example product",
        target_audience: "Teams",
        primary_cta: "Start",
      },
      evidence: [],
      evidenceCoverage: {
        pagesTotal: 1,
        pagesAcquired: 1,
        pagesFailed: 0,
        charsTotal: 100,
        categories: { identity: 1 },
      },
      finalCoverage: {
        identity: "medium",
        positioning: "medium",
        messaging: "medium",
        conversion: "low",
        trust: "low",
        market: "low",
        growth: "low",
      },
      pagesInspected: 1,
      budgetUsage: {
        pagesInspected: 1,
        pagesUsed: 1,
        maxPages: 5,
        evidenceChars: 100,
        maxEvidenceChars: 80_000,
        planningRounds: 0,
        maxPlanningRounds: 3,
        gatherTimeoutMs: 40_000,
      },
      stopReason: "discovery_failed",
      investigation: {
        candidatesDiscovered: 0,
        planningRounds: 0,
        pageAttempts: 1,
        stopReason: "discovery_failed",
      },
      audit: {
        company_name: "Example",
        score_interpretation: "Ready",
        pillars: {},
        the_verdict: {},
        priority_matrix: [],
      },
      trace: [],
      evidenceTrace: {} as RunVerdictAuditResult["evidenceTrace"],
      auditContext: {} as RunVerdictAuditResult["auditContext"],
      modelProvenance: { planner: [] },
    } as RunVerdictAuditResult;

    const summary = summarizeVerdictAuditResult(result);

    expect(summary).toMatchObject({
      pagesInspected: 1,
      finalCoverage: result.finalCoverage,
      budgetUsage: result.budgetUsage,
      stopReason: "discovery_failed",
      evidence: [],
    });
    expect(Object.keys(summary)).toEqual([
      "reportId",
      "overallScore",
      "identity",
      "pagesInspected",
      "evidence",
      "evidenceCoverage",
      "finalCoverage",
      "budgetUsage",
      "stopReason",
      "investigation",
      "company_name",
      "score_interpretation",
      "the_verdict",
      "priority_matrix",
      "pillars",
    ]);
    expect(summary).not.toHaveProperty("trace");
    expect(summary).not.toHaveProperty("evidenceTrace");
    expect(summary).not.toHaveProperty("auditContext");
  });
});
