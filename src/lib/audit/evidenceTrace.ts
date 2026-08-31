import type {
  AuditBudget,
  EvidenceCoverageAssessment,
  EvidencePage,
  EvidencePageSummary,
  EvidenceRejectionReason,
} from "@/lib/audit/evidence";
import {
  isAcceptedEvidencePage,
  isRejectedEvidencePage,
  summarizeEvidencePage,
} from "@/lib/audit/evidence";
import type { EvidenceGatherStopReason } from "@/lib/audit/gather";
import type {
  EvidenceSourceId,
  EvidenceSourceReference,
} from "@/lib/audit/source";

export type EvidenceBudgetUsage = {
  pagesInspected: number;
  pagesAccepted?: number;
  pagesRejected?: number;
  pagesFailed?: number;
  pagesUsed: number;
  maxPages: number;
  evidenceChars: number;
  fetchedEvidenceChars?: number;
  maxEvidenceChars: number;
  planningRounds: number;
  maxPlanningRounds: number;
  gatherTimeoutMs: number;
};

export type PersistedEvidencePage = Omit<EvidencePageSummary, "summary"> & {
  grader?: {
    included: boolean;
    sourceId?: EvidenceSourceId;
    chars: number;
    truncated: boolean;
  };
};

export type PersistedRejectedEvidencePage = Pick<
  EvidencePageSummary,
  "url" | "path" | "role" | "category" | "acquisitionMethod" | "chars"
> & {
  status: "rejected_irrelevant";
  reasonCode: EvidenceRejectionReason;
};

export type PersistedFailedEvidencePage = Pick<
  EvidencePageSummary,
  "url" | "path" | "role" | "category" | "acquisitionMethod"
> & { status: "failed" | "skipped" };

export type EvidenceTrace = {
  version: 1;
  pages: PersistedEvidencePage[];
  rejectedPages?: PersistedRejectedEvidencePage[];
  failedPages?: PersistedFailedEvidencePage[];
  coverage: EvidenceCoverageAssessment;
  planningRounds: number;
  budget: EvidenceBudgetUsage;
  stopReason: EvidenceGatherStopReason;
};

export function successfulEvidencePages(
  pages: EvidencePage[]
): EvidencePage[] {
  return pages.filter(isAcceptedEvidencePage);
}

export function createEvidenceBudgetUsage(input: {
  pages: EvidencePage[];
  pageAttempts: number;
  planningRounds: number;
  budget: AuditBudget;
}): EvidenceBudgetUsage {
  const acquired = input.pages.filter((page) => page.status === "acquired");
  const accepted = input.pages.filter(isAcceptedEvidencePage);
  const rejected = input.pages.filter(isRejectedEvidencePage);
  const failed = input.pages.filter(
    (page) => page.status === "failed" || page.status === "skipped"
  );

  return {
    pagesInspected: acquired.length,
    pagesAccepted: accepted.length,
    pagesRejected: rejected.length,
    pagesFailed: failed.length,
    pagesUsed: input.pageAttempts,
    maxPages: input.budget.maxPagesTotal,
    evidenceChars: accepted.reduce((total, page) => total + page.chars, 0),
    fetchedEvidenceChars: acquired.reduce(
      (total, page) => total + page.chars,
      0
    ),
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
  graderSources?: EvidenceSourceReference[];
}): EvidenceTrace {
  const graderByUrl = new Map(
    (input.graderSources ?? []).map((source) => [source.url, source])
  );
  const pages = successfulEvidencePages(input.pages).map((page) => {
    const { summary: _summary, ...persisted } = summarizeEvidencePage(page);
    const grader = graderByUrl.get(page.url);
    return {
      ...persisted,
      ...(input.graderSources
        ? {
            grader: grader
              ? {
                  included: true,
                  sourceId: grader.sourceId,
                  chars: grader.graderChars ?? grader.chars,
                  truncated: grader.truncated ?? false,
                }
              : {
                  included: false,
                  chars: 0,
                  truncated: true,
                },
          }
        : {}),
    };
  });
  const rejectedPages = input.pages
    .filter(isRejectedEvidencePage)
    .map((page) => ({
      url: page.url,
      path: page.path,
      role: page.role,
      ...(page.category ? { category: page.category } : {}),
      acquisitionMethod: page.acquisitionMethod,
      chars: page.chars,
      status: "rejected_irrelevant" as const,
      reasonCode:
        page.admission?.status === "rejected_irrelevant"
          ? page.admission.reasonCode
          : "relevance_unverified",
    }));
  const failedPages = input.pages
    .filter((page) => page.status === "failed" || page.status === "skipped")
    .map((page) => ({
      url: page.url,
      path: page.path,
      role: page.role,
      ...(page.category ? { category: page.category } : {}),
      acquisitionMethod: page.acquisitionMethod,
      status: page.status as "failed" | "skipped",
    }));

  return {
    version: 1,
    pages,
    ...(rejectedPages.length > 0 ? { rejectedPages } : {}),
    ...(failedPages.length > 0 ? { failedPages } : {}),
    coverage: { ...input.coverage },
    planningRounds: input.planningRounds,
    budget: createEvidenceBudgetUsage(input),
    stopReason: input.stopReason,
  };
}
