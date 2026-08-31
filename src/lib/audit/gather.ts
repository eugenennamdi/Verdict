import {
  admitEvidencePages,
  type EvidenceAdmissionInput,
} from "@/lib/audit/admission";
import {
  acquireEvidencePage,
  type AcquireEvidencePageInput,
} from "@/lib/audit/acquire";
import {
  discoverInternalPages,
  type EvidenceCandidate,
} from "@/lib/audit/discover";
import {
  assessEvidenceCoverage,
  createEvidencePage,
  isAcceptedEvidencePage,
  isEvidenceCoverageSufficient,
  resolveAuditBudget,
  type AuditBudget,
  type EvidenceCategory,
  type EvidenceCoverageAssessment,
  type EvidencePage,
} from "@/lib/audit/evidence";
import type { Tracer } from "@/lib/audit/events";
import type { AuditModelObserver } from "@/lib/audit/model";
import { buildGraderEvidencePack } from "@/lib/audit/source";
import {
  deterministicEvidencePlan,
  planEvidence,
  type EvidencePlan,
  type EvidencePlannerIdentity,
  type PlanEvidenceInput,
} from "@/lib/audit/plan";

export type EvidenceGatherStopReason =
  | "sufficient"
  | "page_budget"
  | "planning_round_budget"
  | "character_budget"
  | "gather_timeout"
  | "discovery_failed"
  | "no_candidates"
  | "no_selection";

export type EvidenceGatherResult = {
  pages: EvidencePage[];
  coverage: EvidenceCoverageAssessment;
  candidatesDiscovered: number;
  candidatesRetained: number;
  planningRounds: number;
  pageAttempts: number;
  stopReason: EvidenceGatherStopReason;
};

export type EvidenceGatherServices = {
  discover: (rootUrl: string, timeoutMs: number) => Promise<EvidenceCandidate[]>;
  plan: (
    input: PlanEvidenceInput,
    options?: { onModelResult?: AuditModelObserver }
  ) => Promise<EvidencePlan>;
  acquire: (input: AcquireEvidencePageInput) => Promise<EvidencePage>;
  admit: (
    input: EvidenceAdmissionInput,
    timeoutMs: number,
    onModelResult?: AuditModelObserver
  ) => Promise<EvidencePage[]>;
  now: () => number;
};

export type GatherEvidenceInput = {
  rootUrl: string;
  identity: EvidencePlannerIdentity;
  homepage: EvidencePage;
  budget?: Partial<AuditBudget>;
  startedAt?: number;
  tracer: Tracer;
  onModelResult?: AuditModelObserver;
  services?: Partial<EvidenceGatherServices>;
};

class GatherTimeoutError extends Error {
  constructor() {
    super("Evidence gathering timed out");
    this.name = "GatherTimeoutError";
  }
}

const DEFAULT_SERVICES: EvidenceGatherServices = {
  discover: (rootUrl, timeoutMs) =>
    discoverInternalPages(rootUrl, { timeoutMs }),
  plan: (input, options) => planEvidence(input, options),
  acquire: (input) => acquireEvidencePage(input),
  admit: (input, timeoutMs, onModelResult) =>
    admitEvidencePages(input, { timeoutMs, onModelResult }),
  now: () => Date.now(),
};

function categoryLabel(category: EvidenceCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function inspectionLabel(candidate: EvidenceCandidate): string {
  const segment = candidate.path.split("/").filter(Boolean).at(-1);
  return (segment || candidate.category || "page").replace(/[-_]+/g, " ");
}

function remainingGatherTime(
  budget: AuditBudget,
  startedAt: number,
  now: () => number
): number {
  return Math.max(0, budget.gatherTimeoutMs - (now() - startedAt));
}

async function withinGatherTime<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) throw new GatherTimeoutError();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new GatherTimeoutError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function totalEvidenceChars(pages: EvidencePage[]): number {
  return pages.reduce(
    (total, page) =>
      isAcceptedEvidencePage(page) ? total + page.chars : total,
    0
  );
}

function finish(
  pages: EvidencePage[],
  candidatesDiscovered: number,
  planningRounds: number,
  pageAttempts: number,
  stopReason: EvidenceGatherStopReason
): EvidenceGatherResult {
  return {
    pages,
    coverage: assessEvidenceCoverage(pages),
    candidatesDiscovered,
    candidatesRetained: candidatesDiscovered,
    planningRounds,
    pageAttempts,
    stopReason,
  };
}

export async function gatherAuditEvidence(
  input: GatherEvidenceInput
): Promise<EvidenceGatherResult> {
  const budget = resolveAuditBudget(input.budget);
  const services = { ...DEFAULT_SERVICES, ...input.services };
  const pages: EvidencePage[] = [input.homepage];
  const visited = new Set([input.homepage.url]);
  const startedAt = input.startedAt ?? services.now();
  let pageAttempts = 1;
  let planningRounds = 0;

  if (pageAttempts >= budget.maxPagesTotal) {
    return finish(pages, 0, planningRounds, pageAttempts, "page_budget");
  }
  if (totalEvidenceChars(pages) >= budget.maxEvidenceChars) {
    return finish(pages, 0, planningRounds, pageAttempts, "character_budget");
  }

  let candidates: EvidenceCandidate[];
  try {
    const remaining = remainingGatherTime(budget, startedAt, services.now);
    candidates = await withinGatherTime(
      services.discover(input.rootUrl, remaining),
      remaining
    );
  } catch (error) {
    const stopReason =
      error instanceof GatherTimeoutError
        ? "gather_timeout"
        : "discovery_failed";
    return finish(pages, 0, planningRounds, pageAttempts, stopReason);
  }

  if (candidates.length > 0) {
    input.tracer.emit(
      "site.pages_discovered",
      `${candidates.length} candidate URL${candidates.length === 1 ? "" : "s"} retained`,
      {
        count: candidates.length,
        candidatesRetained: candidates.length,
        countSemantics: "retained_candidate_urls",
        sample: candidates.slice(0, 3).map((candidate) => candidate.url),
      }
    );
  }

  if (candidates.length === 0) {
    return finish(pages, 0, planningRounds, pageAttempts, "no_candidates");
  }

  while (true) {
    const charsUsed = totalEvidenceChars(pages);
    if (pageAttempts >= budget.maxPagesTotal) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "page_budget"
      );
    }
    if (planningRounds >= budget.maxPlanningRounds) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "planning_round_budget"
      );
    }
    if (charsUsed >= budget.maxEvidenceChars) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "character_budget"
      );
    }

    const timeRemaining = remainingGatherTime(
      budget,
      startedAt,
      services.now
    );
    if (timeRemaining <= 0) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "gather_timeout"
      );
    }

    const coverage = assessEvidenceCoverage(pages);
    if (isEvidenceCoverageSufficient(coverage)) {
      input.tracer.emit("evidence.sufficient", "Evidence coverage is sufficient", {
        coverage,
      });
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "sufficient"
      );
    }

    const remainingCandidates = candidates.filter(
      (candidate) =>
        !visited.has(candidate.url) &&
        Boolean(candidate.category) &&
        candidate.ranking.priority > 0
    );
    if (remainingCandidates.length === 0) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "no_candidates"
      );
    }

    planningRounds++;
    const plannerInput: PlanEvidenceInput = {
      identity: input.identity,
      pages,
      currentCoverage: coverage,
      candidates: remainingCandidates,
      budget: {
        pagesRemaining: budget.maxPagesTotal - pageAttempts,
        planningRoundsRemaining: budget.maxPlanningRounds - planningRounds,
        maxUrlsThisRound: Math.min(
          budget.maxUrlsPerRound,
          budget.maxPagesTotal - pageAttempts
        ),
        evidenceCharsRemaining: budget.maxEvidenceChars - charsUsed,
        gatherTimeRemainingMs: timeRemaining,
      },
    };

    let plan: EvidencePlan;
    try {
      plan = await withinGatherTime(
        services.plan(plannerInput, {
          onModelResult: input.onModelResult,
        }),
        timeRemaining
      );
    } catch (error) {
      if (error instanceof GatherTimeoutError) {
        return finish(
          pages,
          candidates.length,
          planningRounds,
          pageAttempts,
          "gather_timeout"
        );
      }
      plan = deterministicEvidencePlan(plannerInput, "error");
    }

    if (plan.done) {
      input.tracer.emit("evidence.sufficient", "Evidence coverage is sufficient", {
        coverage: plan.coverage,
      });
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "sufficient"
      );
    }

    const selections = plan.selections.filter(
      (selection) =>
        !visited.has(selection.url) &&
        remainingCandidates.some(
          (candidate) =>
            candidate.url === selection.url &&
            candidate.category === selection.category
        )
    );
    if (selections.length === 0) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "no_selection"
      );
    }

    const missingCategories = plan.missing.filter(
      (category, index, all) => all.indexOf(category) === index
    );
    if (missingCategories.length > 0) {
      const labels = missingCategories.map(categoryLabel).join(", ");
      input.tracer.emit(
        "evidence.insufficient",
        `${labels} evidence needs more context`,
        { categories: missingCategories, coverage: plan.coverage }
      );
    }

    const acquiredThisRound: EvidencePage[] = [];
    let roundTimedOut = false;
    for (const selection of selections) {
      if (pageAttempts >= budget.maxPagesTotal) break;
      const pendingChars = acquiredThisRound.reduce(
        (total, page) => total + page.chars,
        0
      );
      const currentChars = totalEvidenceChars(pages) + pendingChars;
      if (currentChars >= budget.maxEvidenceChars) break;

      const acquisitionTimeRemaining = remainingGatherTime(
        budget,
        startedAt,
        services.now
      );
      if (acquisitionTimeRemaining <= 0) {
        return finish(
          pages,
          candidates.length,
          planningRounds,
          pageAttempts,
          "gather_timeout"
        );
      }

      const candidate = remainingCandidates.find(
        (item) => item.url === selection.url
      );
      if (!candidate || visited.has(selection.url)) continue;

      visited.add(selection.url);
      const pagesUsedBeforeAttempt = pageAttempts;
      pageAttempts++;
      input.tracer.emit(
        "evidence.selected",
        `Inspecting ${inspectionLabel(candidate)}`,
        {
          url: selection.url,
          category: selection.category,
          reasonCode: selection.reasonCode,
        }
      );

      let page: EvidencePage;
      try {
        page = await withinGatherTime(
          services.acquire({
            url: selection.url,
            role: "supporting",
            category: selection.category,
            budget: {
              ...budget,
              gatherTimeoutMs: acquisitionTimeRemaining,
            },
            pagesUsed: pagesUsedBeforeAttempt,
            evidenceCharsUsed: currentChars,
          }),
          acquisitionTimeRemaining
        );
      } catch (error) {
        page = createEvidencePage({
          url: selection.url,
          role: "supporting",
          category: selection.category,
          status: "failed",
          error:
            error instanceof GatherTimeoutError
              ? "Evidence gathering timed out"
              : error instanceof Error
                ? error.message
                : String(error),
        });
      }

      if (
        page.status === "acquired" &&
        page.chars > budget.maxEvidenceChars - currentChars
      ) {
        page = createEvidencePage({
          url: page.url,
          role: page.role,
          category: page.category,
          acquisitionMethod: page.acquisitionMethod,
          markdown: page.markdown.slice(
            0,
            Math.max(0, budget.maxEvidenceChars - currentChars)
          ),
          status: "acquired",
        });
      }

      if (page.status === "acquired") acquiredThisRound.push(page);
      else pages.push(page);

      if (
        page.error === "Evidence gathering timed out" ||
        remainingGatherTime(budget, startedAt, services.now) <= 0
      ) {
        roundTimedOut = true;
        break;
      }
    }

    if (acquiredThisRound.length > 0) {
      const admissionTimeRemaining = remainingGatherTime(
        budget,
        startedAt,
        services.now
      );
      let admitted: EvidencePage[];
      if (admissionTimeRemaining <= 0) {
        admitted = acquiredThisRound.map((page) => ({
          ...page,
          admission: {
            status: "rejected_irrelevant" as const,
            method: "fail_closed" as const,
            reasonCode: "relevance_unverified" as const,
          },
        }));
      } else {
        try {
          admitted = await withinGatherTime(
            services.admit(
              {
                rootUrl: input.rootUrl,
                identity: input.identity,
                pages: acquiredThisRound,
              },
              admissionTimeRemaining,
              input.onModelResult
            ),
            admissionTimeRemaining
          );
        } catch {
          admitted = acquiredThisRound.map((page) => ({
            ...page,
            admission: {
              status: "rejected_irrelevant" as const,
              method: "fail_closed" as const,
              reasonCode: "relevance_unverified" as const,
            },
          }));
        }
      }

      pages.push(...admitted);
      for (const page of admitted) {
        if (!isAcceptedEvidencePage(page)) continue;
        input.tracer.emit(
          "evidence.acquired",
          `${categoryLabel(page.category!)} evidence collected`,
          {
            url: page.url,
            category: page.category,
            chars: page.chars,
          }
        );
      }

      if (
        roundTimedOut ||
        admissionTimeRemaining <= 0 ||
        remainingGatherTime(budget, startedAt, services.now) <= 0
      ) {
        return finish(
          pages,
          candidates.length,
          planningRounds,
          pageAttempts,
          "gather_timeout"
        );
      }
    }

    if (roundTimedOut) {
      return finish(
        pages,
        candidates.length,
        planningRounds,
        pageAttempts,
        "gather_timeout"
      );
    }
  }
}

export function combineEvidenceForGrading(
  pages: EvidencePage[],
  budgetOverrides: Partial<AuditBudget> = {}
): string {
  return buildGraderEvidencePack(pages, budgetOverrides).markdown;
}
