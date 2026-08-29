import { Type } from "@google/genai";
import type { EvidenceCandidate } from "@/lib/audit/discover";
import {
  EVIDENCE_CATEGORIES,
  isEvidenceCoverageSufficient,
  summarizeEvidencePage,
  type EvidenceCategory,
  type EvidenceCoverageAssessment,
  type EvidencePage,
} from "@/lib/audit/evidence";

export const EVIDENCE_REASON_CODES = [
  "identity_evidence_needed",
  "positioning_evidence_needed",
  "messaging_evidence_needed",
  "conversion_evidence_needed",
  "trust_evidence_needed",
  "market_evidence_needed",
  "growth_evidence_needed",
] as const;

export type EvidenceReasonCode = (typeof EVIDENCE_REASON_CODES)[number];

export type PlannedEvidenceSelection = {
  url: string;
  category: EvidenceCategory;
  reasonCode: EvidenceReasonCode;
};

export type EvidencePlan = {
  done: boolean;
  coverage: EvidenceCoverageAssessment;
  missing: EvidenceCategory[];
  selections: PlannedEvidenceSelection[];
  source: "model" | "fallback";
  fallbackReason?:
    | "timeout"
    | "malformed"
    | "error"
    | "invalid_selection"
    | "no_selection";
};

export type EvidencePlannerIdentity = {
  company_name: string;
  inferred_description: string;
  target_audience: string;
  primary_cta: string;
};

export type EvidencePlannerBudget = {
  pagesRemaining: number;
  planningRoundsRemaining: number;
  maxUrlsThisRound: number;
  evidenceCharsRemaining: number;
  gatherTimeRemainingMs: number;
};

export type PlanEvidenceInput = {
  identity: EvidencePlannerIdentity;
  pages: EvidencePage[];
  currentCoverage: EvidenceCoverageAssessment;
  candidates: EvidenceCandidate[];
  budget: EvidencePlannerBudget;
};

export type PlannerGenerator = (
  prompt: string,
  schema: unknown,
  timeoutMs: number
) => Promise<string>;

export type PlanEvidenceOptions = {
  generate?: PlannerGenerator;
  timeoutMs?: number;
};

const COVERAGE_LEVELS = ["low", "medium", "high"] as const;
const PLANNER_TIMEOUT_MS = 8_000;

const coverageProperties = Object.fromEntries(
  EVIDENCE_CATEGORIES.map((category) => [
    category,
    { type: Type.STRING, enum: COVERAGE_LEVELS },
  ])
);

export const EVIDENCE_PLANNER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    done: { type: Type.BOOLEAN },
    coverage: {
      type: Type.OBJECT,
      properties: coverageProperties,
      required: [...EVIDENCE_CATEGORIES],
    },
    missing: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: EVIDENCE_CATEGORIES },
    },
    selections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING },
          category: { type: Type.STRING, enum: EVIDENCE_CATEGORIES },
          reasonCode: { type: Type.STRING, enum: EVIDENCE_REASON_CODES },
        },
        required: ["url", "category", "reasonCode"],
      },
    },
  },
  required: ["done", "coverage", "missing", "selections"],
};

class PlannerTimeoutError extends Error {
  constructor() {
    super("Evidence planner timed out");
    this.name = "PlannerTimeoutError";
  }
}

class PlannerResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerResponseError";
  }
}

function reasonCodeForCategory(
  category: EvidenceCategory
): EvidenceReasonCode {
  return `${category}_evidence_needed` as EvidenceReasonCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEvidenceCategory(value: unknown): value is EvidenceCategory {
  return (
    typeof value === "string" &&
    EVIDENCE_CATEGORIES.includes(value as EvidenceCategory)
  );
}

function parseCoverage(value: unknown): EvidenceCoverageAssessment {
  if (!isRecord(value)) {
    throw new PlannerResponseError("Planner coverage is missing");
  }

  const coverage = {} as EvidenceCoverageAssessment;
  for (const category of EVIDENCE_CATEGORIES) {
    const level = value[category];
    if (
      typeof level !== "string" ||
      !COVERAGE_LEVELS.includes(level as (typeof COVERAGE_LEVELS)[number])
    ) {
      throw new PlannerResponseError("Planner coverage is malformed");
    }
    coverage[category] = level as EvidenceCoverageAssessment[EvidenceCategory];
  }
  return coverage;
}

function plannerPrompt(input: PlanEvidenceInput): string {
  const evidence = input.pages
    .filter((page) => page.status === "acquired")
    .map((page) => summarizeEvidencePage(page));
  const candidates = input.candidates.map((candidate) => ({
    url: candidate.url,
    path: candidate.path,
    category: candidate.category,
    priority: candidate.ranking.priority,
    matchedKeyword: candidate.ranking.matchedKeyword,
  }));

  return `
You are Verdict's bounded evidence selector. Decide whether the current compact
evidence is sufficient for a final seven-pillar growth-readiness audit. If more
evidence is needed, select only useful URLs from CANDIDATES.

Rules:
- Never invent or alter a URL.
- Select at most ${input.budget.maxUrlsThisRound} URLs.
- Prefer categories with low coverage, then medium coverage.
- Use only the allowed deterministic reason codes.
- Return structured JSON only. Do not include reasoning or explanatory prose.

STARTUP_IDENTITY:
${JSON.stringify(input.identity)}

CURRENT_COVERAGE:
${JSON.stringify(input.currentCoverage)}

INSPECTED_EVIDENCE_SUMMARIES:
${JSON.stringify(evidence)}

CANDIDATES:
${JSON.stringify(candidates)}

REMAINING_BUDGET:
${JSON.stringify(input.budget)}
`;
}

async function defaultPlannerGenerator(
  prompt: string,
  schema: unknown,
  timeoutMs: number
): Promise<string> {
  const { generateStructuredJson } = await import("@/lib/engine");
  return generateStructuredJson(prompt, schema, timeoutMs);
}

async function withPlannerTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PlannerTimeoutError()), timeoutMs);
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

export function deterministicEvidencePlan(
  input: PlanEvidenceInput,
  fallbackReason?: EvidencePlan["fallbackReason"]
): EvidencePlan {
  const missing = EVIDENCE_CATEGORIES.filter(
    (category) => input.currentCoverage[category] === "low"
  );
  const done = isEvidenceCoverageSufficient(input.currentCoverage);

  if (done) {
    return {
      done: true,
      coverage: input.currentCoverage,
      missing: [],
      selections: [],
      source: "fallback",
      ...(fallbackReason ? { fallbackReason } : {}),
    };
  }

  const levelRank = { low: 0, medium: 1, high: 2 } as const;
  const useful = input.candidates
    .filter(
      (candidate): candidate is EvidenceCandidate & {
        category: EvidenceCategory;
      } =>
        Boolean(candidate.category) &&
        candidate.ranking.priority > 0 &&
        input.currentCoverage[candidate.category as EvidenceCategory] !== "high"
    )
    .sort((left, right) => {
      const coverageDifference =
        levelRank[input.currentCoverage[left.category]] -
        levelRank[input.currentCoverage[right.category]];
      return (
        coverageDifference ||
        right.ranking.priority - left.ranking.priority ||
        left.url.localeCompare(right.url)
      );
    });

  const selectionLimit = Math.max(
    0,
    Math.min(
      input.budget.maxUrlsThisRound,
      input.budget.pagesRemaining,
      useful.length
    )
  );
  const selected: typeof useful = [];
  const selectedCategories = new Set<EvidenceCategory>();

  for (const candidate of useful) {
    if (selected.length >= selectionLimit) break;
    if (selectedCategories.has(candidate.category)) continue;
    selected.push(candidate);
    selectedCategories.add(candidate.category);
  }
  for (const candidate of useful) {
    if (selected.length >= selectionLimit) break;
    if (selected.some((item) => item.url === candidate.url)) continue;
    selected.push(candidate);
  }

  return {
    done: false,
    coverage: input.currentCoverage,
    missing,
    selections: selected.map((candidate) => ({
      url: candidate.url,
      category: candidate.category,
      reasonCode: reasonCodeForCategory(candidate.category),
    })),
    source: "fallback",
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

function validatePlannerResponse(
  raw: string,
  input: PlanEvidenceInput
): EvidencePlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlannerResponseError("Planner returned invalid JSON");
  }
  if (!isRecord(parsed) || typeof parsed.done !== "boolean") {
    throw new PlannerResponseError("Planner response is malformed");
  }

  const coverage = parseCoverage(parsed.coverage);
  if (!Array.isArray(parsed.missing) || !Array.isArray(parsed.selections)) {
    throw new PlannerResponseError("Planner response is malformed");
  }
  if (!parsed.missing.every(isEvidenceCategory)) {
    throw new PlannerResponseError("Planner missing categories are malformed");
  }

  const candidateByUrl = new Map(
    input.candidates.map((candidate) => [candidate.url, candidate])
  );
  const validSelections: PlannedEvidenceSelection[] = [];
  const seen = new Set<string>();
  let invalidSelectionCount = 0;

  for (const selection of parsed.selections) {
    if (
      !isRecord(selection) ||
      typeof selection.url !== "string" ||
      !isEvidenceCategory(selection.category) ||
      typeof selection.reasonCode !== "string"
    ) {
      throw new PlannerResponseError("Planner selections are malformed");
    }

    const candidate = candidateByUrl.get(selection.url);
    const expectedReason = reasonCodeForCategory(selection.category);
    if (
      !candidate?.category ||
      candidate.category !== selection.category ||
      selection.reasonCode !== expectedReason ||
      seen.has(selection.url)
    ) {
      invalidSelectionCount++;
      continue;
    }

    seen.add(selection.url);
    validSelections.push({
      url: candidate.url,
      category: candidate.category,
      reasonCode: expectedReason,
    });
  }

  if (invalidSelectionCount > 0) {
    return deterministicEvidencePlan(input, "invalid_selection");
  }

  const selectionLimit = Math.max(
    0,
    Math.min(input.budget.maxUrlsThisRound, input.budget.pagesRemaining)
  );
  const selections = validSelections.slice(0, selectionLimit);
  if (!parsed.done && selections.length === 0) {
    return deterministicEvidencePlan(input, "no_selection");
  }

  const missing = Array.from(new Set(parsed.missing));
  if (parsed.done && !isEvidenceCoverageSufficient(coverage)) {
    return deterministicEvidencePlan(input, "no_selection");
  }
  const done =
    parsed.done ||
    (missing.length === 0 && isEvidenceCoverageSufficient(coverage));

  return {
    done,
    coverage,
    missing,
    selections: done ? [] : selections,
    source: "model",
  };
}

export async function planEvidence(
  input: PlanEvidenceInput,
  options: PlanEvidenceOptions = {}
): Promise<EvidencePlan> {
  if (
    input.candidates.length === 0 ||
    input.budget.pagesRemaining <= 0 ||
    input.budget.maxUrlsThisRound <= 0 ||
    input.budget.gatherTimeRemainingMs <= 0
  ) {
    return deterministicEvidencePlan(input);
  }

  if (isEvidenceCoverageSufficient(input.currentCoverage)) {
    return deterministicEvidencePlan(input);
  }

  const timeoutMs = Math.max(
    1,
    Math.min(
      options.timeoutMs ?? PLANNER_TIMEOUT_MS,
      input.budget.gatherTimeRemainingMs
    )
  );

  try {
    const raw = await withPlannerTimeout(
      (options.generate ?? defaultPlannerGenerator)(
        plannerPrompt(input),
        EVIDENCE_PLANNER_SCHEMA,
        timeoutMs
      ),
      timeoutMs
    );
    return validatePlannerResponse(raw, input);
  } catch (error) {
    if (error instanceof PlannerTimeoutError) {
      return deterministicEvidencePlan(input, "timeout");
    }
    if (error instanceof PlannerResponseError) {
      return deterministicEvidencePlan(input, "malformed");
    }
    return deterministicEvidencePlan(input, "error");
  }
}
