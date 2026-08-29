import type {
  AuditBudget,
  EvidenceCoverageAssessment,
  EvidencePage,
  EvidencePageSummary,
} from "@/lib/audit/evidence";
import { summarizeEvidencePage } from "@/lib/audit/evidence";
import type { EvidenceGatherStopReason } from "@/lib/audit/gather";

export type EvidenceBudgetUsage = {
  pagesInspected: number;
  pagesUsed: number;
  maxPages: number;
  evidenceChars: number;
  maxEvidenceChars: number;
  planningRounds: number;
  maxPlanningRounds: number;
  gatherTimeoutMs: number;
};

export type PersistedEvidencePage = Omit<EvidencePageSummary, "summary">;

export type EvidenceTrace = {
  version: 1;
  pages: PersistedEvidencePage[];
  coverage: EvidenceCoverageAssessment;
  planningRounds: number;
  budget: EvidenceBudgetUsage;
  stopReason: EvidenceGatherStopReason;
};

export function successfulEvidencePages(
  pages: EvidencePage[]
): EvidencePage[] {
  return pages.filter((page) => page.status === "acquired");
}

export function createEvidenceBudgetUsage(input: {
  pages: EvidencePage[];
  pageAttempts: number;
  planningRounds: number;
  budget: AuditBudget;
}): EvidenceBudgetUsage {
  const acquired = successfulEvidencePages(input.pages);

  return {
    pagesInspected: acquired.length,
    pagesUsed: input.pageAttempts,
    maxPages: input.budget.maxPagesTotal,
    evidenceChars: acquired.reduce((total, page) => total + page.chars, 0),
    maxEvidenceChars: input.budget.maxEvidenceChars,
    planningRounds: input.planningRounds,
    maxPlanningRounds: input.budget.maxPlanningRounds,
    gatherTimeoutMs: input.budget.gatherTimeoutMs,
  };
}

export function serializeEvidenceTrace(input: {
  pages: EvidencePage[];
  coverage: EvidenceCoverageAssessment;
  planningRounds: number;
  pageAttempts: number;
  budget: AuditBudget;
  stopReason: EvidenceGatherStopReason;
}): EvidenceTrace {
  const pages = successfulEvidencePages(input.pages).map((page) => {
    const { summary: _summary, ...persisted } = summarizeEvidencePage(page);
    return persisted;
  });

  return {
    version: 1,
    pages,
    coverage: { ...input.coverage },
    planningRounds: input.planningRounds,
    budget: createEvidenceBudgetUsage(input),
    stopReason: input.stopReason,
  };
}
