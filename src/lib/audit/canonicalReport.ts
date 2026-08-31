import {
  PILLAR_WEIGHTS,
  computeOverallScore,
  type PillarKey,
} from "./score";

export const PILLAR_LABELS: Record<PillarKey, string> = {
  positioning: "Positioning",
  messaging: "Messaging",
  website_ux: "Website & UX",
  conversion: "Conversion",
  trust: "Trust",
  competition: "Market & Competition",
  growth_foundation: "Growth Foundation",
};

export type PillarStanding =
  | "strongest"
  | "weakest"
  | "between_strongest_and_weakest"
  | "in_line";

export type CanonicalDimensionFact = {
  key: PillarKey;
  label: string;
  score: number;
  standing: PillarStanding;
  standingLabel: string;
  confidence: string;
  reason: string;
  strengths: string[];
  weaknesses: string[];
};

export type CanonicalPriorityFact = {
  task: string;
  impact: string;
  effort: string;
  why: string;
};

export type CanonicalReportFacts = {
  reportId?: string;
  url?: string;
  domain?: string;
  companyName: string;
  description: string;
  overallScore: number;
  executiveAssessment: string;
  primaryBottleneck: string;
  highestOpportunity: string;
  estimatedImpact: string;
  dimensionRankingAvailable: boolean;
  strongestDimension: {
    key: PillarKey;
    label: string;
    score: number;
  };
  weakestDimension: {
    key: PillarKey;
    label: string;
    score: number;
  };
  rankedDimensions: Array<{
    key: PillarKey;
    label: string;
    score: number;
    standing: PillarStanding;
    standingLabel: string;
  }>;
  priorities: CanonicalPriorityFact[];
  dimensions: Record<PillarKey, CanonicalDimensionFact>;
};

export type CanonicalReportProjection = {
  reportId?: string;
  companyName: string;
  description?: string;
  overallScore: number;
  executiveAssessment?: string;
  dimensionRankingAvailable?: boolean;
  strongestDimension?: { key: PillarKey; label: string };
  weakestDimension?: { key: PillarKey; label: string };
  primaryBottleneck: string;
  highestOpportunity: string;
  estimatedImpact?: string;
  priorities?: CanonicalPriorityFact[];
  /** Retained for compatibility with projections cached before priorities were first-class. */
  topPriority: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringVal(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberVal(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pillarKeyVal(value: unknown): PillarKey | undefined {
  return typeof value === "string" && value in PILLAR_WEIGHTS
    ? (value as PillarKey)
    : undefined;
}

/**
 * Extracts and normalizes canonical report facts deterministically from any
 * internal audit result, persisted row, or audit context pack.
 *
 * This is the SINGLE AUTHORITATIVE SOURCE OF TRUTH across Verdict for:
 * - Growth Readiness Score
 * - Strongest / weakest pillar determination and ranking
 * - Primary bottleneck
 * - Recommended priorities
 * - Executive assessment
 */
export function deriveCanonicalReportFacts(raw: unknown): CanonicalReportFacts {
  const obj = isRecord(raw) ? raw : {};

  // Extract nested properties from AuditContextPackV1, AuditSummary, or PersistedReportContextRow
  const context = isRecord(obj.context) ? obj.context : obj;
  const projectedFacts = isRecord(context.canonicalReportFacts)
    ? context.canonicalReportFacts
    : isRecord(obj.canonicalReportFacts)
      ? obj.canonicalReportFacts
      : {};

  const audited = isRecord(context.audited) ? context.audited : {};
  const identity = isRecord(context.companyIdentity)
    ? context.companyIdentity
    : isRecord(context.identity)
      ? context.identity
      : {};

  const outcome = isRecord(context.outcome) ? context.outcome : {};
  const finalVerdict = isRecord(outcome.finalVerdict)
    ? outcome.finalVerdict
    : isRecord(context.the_verdict)
      ? context.the_verdict
      : isRecord(context.key_risks)
        ? context.key_risks
        : {};

  const reportId =
    stringVal(obj.reportId) ||
    stringVal(context.reportId) ||
    stringVal(obj.id);

  const url = stringVal(audited.url) || stringVal(context.url) || stringVal(obj.url);
  const domain =
    stringVal(audited.domain) ||
    stringVal(context.domain) ||
    (url ? (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })() : "");

  const companyName =
    stringVal(projectedFacts.companyName) ||
    stringVal(identity.company_name) ||
    stringVal(context.company_name) ||
    stringVal(obj.company_name) ||
    domain ||
    "Target Startup";

  const description =
    stringVal(projectedFacts.description) ||
    stringVal(identity.inferred_description) ||
    stringVal(context.inferred_description) ||
    "";

  const executiveAssessment =
    stringVal(projectedFacts.executiveAssessment) ||
    stringVal(outcome.scoreInterpretation) ||
    stringVal(context.score_interpretation) ||
    stringVal(context.executive_summary) ||
    stringVal(obj.executive_summary) ||
    "";

  const primaryBottleneck =
    stringVal(projectedFacts.primaryBottleneck) ||
    stringVal(finalVerdict.primary_constraint) ||
    executiveAssessment ||
    "Growth constraints observed during investigation.";

  const highestOpportunity =
    stringVal(projectedFacts.highestOpportunity) ||
    stringVal(finalVerdict.highest_opportunity);
  const estimatedImpact =
    stringVal(projectedFacts.estimatedImpact) ||
    stringVal(finalVerdict.estimated_impact);

  // Extract raw pillars
  const rawPillarsObj =
    isRecord(context.pillars)
      ? context.pillars
      : isRecord(context.growth_plan_30_day)
        ? context.growth_plan_30_day
        : isRecord(obj.pillars)
          ? obj.pillars
          : {};

  // Extract priorities
  const rawPriorities = Array.isArray(projectedFacts.priorities)
    ? projectedFacts.priorities
    : Array.isArray(context.priorityMatrix)
      ? context.priorityMatrix
      : Array.isArray(context.priority_matrix)
        ? context.priority_matrix
        : Array.isArray(context.top_5_priorities)
          ? context.top_5_priorities
          : Array.isArray(obj.top_5_priorities)
            ? obj.top_5_priorities
            : stringVal(projectedFacts.topPriority)
              ? [{ task: stringVal(projectedFacts.topPriority) }]
              : [];

  const priorities: CanonicalPriorityFact[] = rawPriorities
    .filter(isRecord)
    .slice(0, 10)
    .map((item) => ({
      task: stringVal(item.task),
      impact: stringVal(item.impact),
      effort: stringVal(item.effort),
      why: stringVal(item.why),
    }))
    .filter((item) => Boolean(item.task));

  // Extract dimension scores & metadata
  const pillarKeys = Object.keys(PILLAR_WEIGHTS) as PillarKey[];
  const dimensionList: Array<{
    key: PillarKey;
    label: string;
    score: number;
    confidence: string;
    reason: string;
    strengths: string[];
    weaknesses: string[];
  }> = [];

  for (const key of pillarKeys) {
    const rawPillar = rawPillarsObj[key];
    let score = 0;
    let confidence = "medium";
    let reason = "";
    let strengths: string[] = [];
    let weaknesses: string[] = [];

    if (typeof rawPillar === "number") {
      score = rawPillar;
    } else if (isRecord(rawPillar)) {
      score = numberVal(rawPillar.score, 0);
      confidence = stringVal(rawPillar.confidence, "medium");
      reason = stringVal(rawPillar.reason);
      strengths = stringArray(rawPillar.strengths);
      weaknesses = stringArray(rawPillar.weaknesses);
    }

    dimensionList.push({
      key,
      label: PILLAR_LABELS[key],
      score: Math.max(0, Math.min(100, Math.round(score))),
      confidence,
      reason,
      strengths,
      weaknesses,
    });
  }

  // Calculate Overall Score if not explicitly provided
  const explicitOverall =
    projectedFacts.overallScore !== undefined
      ? numberVal(projectedFacts.overallScore)
      : outcome.overallScore !== undefined
      ? numberVal(outcome.overallScore)
      : context.overallScore !== undefined
        ? numberVal(context.overallScore)
        : context.fdi_overall_score !== undefined
          ? numberVal(context.fdi_overall_score)
          : obj.fdi_overall_score !== undefined
            ? numberVal(obj.fdi_overall_score)
            : undefined;

  const scoreMap = Object.fromEntries(
    dimensionList.map((d) => [d.key, d.score])
  ) as Record<PillarKey, number>;

  const overallScore =
    explicitOverall !== undefined && Number.isFinite(explicitOverall)
      ? Math.max(0, Math.min(100, Math.round(explicitOverall)))
      : computeOverallScore(scoreMap);

  // Deterministic ranking: Sort dimensions descending by score.
  // Stable secondary tie-breaker uses framework order.
  const rankedOrder = [...dimensionList].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return pillarKeys.indexOf(a.key) - pillarKeys.indexOf(b.key);
  });

  const projectedStrongest = isRecord(projectedFacts.strongestDimension)
    ? pillarKeyVal(projectedFacts.strongestDimension.key)
    : undefined;
  const projectedWeakest = isRecord(projectedFacts.weakestDimension)
    ? pillarKeyVal(projectedFacts.weakestDimension.key)
    : undefined;
  const hasProjectedRanking = Boolean(projectedStrongest && projectedWeakest);
  const hasCompletePillarScores = pillarKeys.every((key) => {
    const rawPillar = rawPillarsObj[key];
    return (
      (typeof rawPillar === "number" && Number.isFinite(rawPillar)) ||
      (isRecord(rawPillar) && Number.isFinite(rawPillar.score))
    );
  });
  const strongestKey = projectedStrongest ?? rankedOrder[0].key;
  const weakestKey = projectedWeakest ?? rankedOrder[rankedOrder.length - 1].key;
  const strongestItem = dimensionList.find((item) => item.key === strongestKey)!;
  const weakestItem = dimensionList.find((item) => item.key === weakestKey)!;
  const canonicalOrder = hasProjectedRanking
    ? [
        strongestItem,
        ...rankedOrder.filter(
          (item) => item.key !== strongestKey && item.key !== weakestKey
        ),
        ...(weakestKey === strongestKey ? [] : [weakestItem]),
      ]
    : rankedOrder;

  const strongestScore = strongestItem.score;
  const weakestScore = weakestItem.score;
  const allEqual = hasProjectedRanking
    ? strongestKey === weakestKey
    : strongestScore === weakestScore;

  const dimensionsRecord: Record<PillarKey, CanonicalDimensionFact> = {} as Record<
    PillarKey,
    CanonicalDimensionFact
  >;

  const rankedDimensions: CanonicalReportFacts["rankedDimensions"] = [];

  const strongestCount = hasProjectedRanking
    ? 1
    : dimensionList.filter((d) => d.score === strongestScore).length;
  const weakestCount = hasProjectedRanking
    ? 1
    : dimensionList.filter((d) => d.score === weakestScore).length;

  for (const item of canonicalOrder) {
    let standing: PillarStanding = "between_strongest_and_weakest";
    let standingLabel = "sat between the strongest and weakest areas";

    if (allEqual) {
      standing = "in_line";
      standingLabel = "was in line with the other areas";
    } else if (
      hasProjectedRanking
        ? item.key === strongestKey
        : item.score === strongestScore
    ) {
      standing = "strongest";
      standingLabel =
        strongestCount === 1
          ? "was the strongest area"
          : "was one of the strongest areas";
    } else if (
      hasProjectedRanking
        ? item.key === weakestKey
        : item.score === weakestScore
    ) {
      standing = "weakest";
      standingLabel =
        weakestCount === 1
          ? "was the weakest area"
          : "was one of the weakest areas";
    }

    const fullDimension: CanonicalDimensionFact = {
      ...item,
      standing,
      standingLabel,
    };

    dimensionsRecord[item.key] = fullDimension;
    rankedDimensions.push({
      key: item.key,
      label: item.label,
      score: item.score,
      standing,
      standingLabel,
    });
  }

  return {
    ...(reportId ? { reportId } : {}),
    ...(url ? { url } : {}),
    ...(domain ? { domain } : {}),
    companyName,
    description,
    overallScore,
    executiveAssessment,
    primaryBottleneck,
    highestOpportunity,
    estimatedImpact,
    dimensionRankingAvailable: hasProjectedRanking || hasCompletePillarScores,
    strongestDimension: {
      key: strongestItem.key,
      label: strongestItem.label,
      score: strongestItem.score,
    },
    weakestDimension: {
      key: weakestItem.key,
      label: weakestItem.label,
      score: weakestItem.score,
    },
    rankedDimensions,
    priorities,
    dimensions: dimensionsRecord,
  };
}

/**
 * Projects only customer-safe canonical conclusions for the workspace. Pillar
 * scores remain server-side; the labels are derived from the same facts used by
 * persisted-report Q&A.
 */
export function projectCanonicalReportFacts(
  raw: unknown
): CanonicalReportProjection {
  const facts = deriveCanonicalReportFacts(raw);
  return {
    ...(facts.reportId ? { reportId: facts.reportId } : {}),
    companyName: facts.companyName,
    description: facts.description,
    overallScore: facts.overallScore,
    executiveAssessment: facts.executiveAssessment,
    dimensionRankingAvailable: facts.dimensionRankingAvailable,
    ...(facts.dimensionRankingAvailable
      ? {
          strongestDimension: {
            key: facts.strongestDimension.key,
            label: facts.strongestDimension.label,
          },
          weakestDimension: {
            key: facts.weakestDimension.key,
            label: facts.weakestDimension.label,
          },
        }
      : {}),
    primaryBottleneck: facts.primaryBottleneck,
    highestOpportunity: facts.highestOpportunity,
    estimatedImpact: facts.estimatedImpact,
    priorities: facts.priorities.map((priority) => ({ ...priority })),
    topPriority: facts.priorities[0]?.task || "",
  };
}
