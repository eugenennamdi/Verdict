import type {
  EvidenceCoverageAssessment,
  EvidenceSignals,
} from "@/lib/audit/evidence";
import type {
  EvidenceBudgetUsage,
} from "@/lib/audit/evidenceTrace";
import type { EvidenceGatherStopReason } from "@/lib/audit/gather";
import {
  GROWTH_READINESS_FRAMEWORK,
  PILLAR_WEIGHTS,
  type PillarKey,
} from "@/lib/audit/score";
import type {
  EvidenceSourceId,
  EvidenceSourceReference,
} from "@/lib/audit/source";

export const VERDICT_ENGINE_VERSION = "1.0.0";

const MAX_FINDINGS_PER_SOURCE = 5;
const MAX_SIGNALS_PER_SOURCE = 8;
const MAX_CONTEXT_TEXT_CHARS = 500;

export type SemanticEvidenceDigest = {
  sourceId: EvidenceSourceId;
  keyFindings: string[];
  relevantSignals: string[];
};

export type AuditContextSource = EvidenceSourceReference & {
  keyFindings: string[];
  relevantSignals: string[];
};

export type AuditContextPillar = {
  score: number;
  confidence: string;
  reason: string;
  strengths: string[];
  weaknesses: string[];
};

export type AuditContextPackV1 = {
  version: 1;
  reportId?: string;
  audited: {
    url: string;
    domain: string;
    timestamp: string;
  };
  companyIdentity: {
    company_name: string;
    inferred_description: string;
    target_audience: string;
    primary_cta: string;
  };
  outcome: {
    overallScore: number;
    scoreInterpretation: string;
    finalVerdict: {
      status: string;
      primary_constraint: string;
      highest_opportunity: string;
      estimated_impact: string;
    };
  };
  pillars: Record<PillarKey, AuditContextPillar>;
  priorityMatrix: Array<{
    task: string;
    impact: string;
    effort: string;
    why: string;
  }>;
  investigation: {
    pagesInspected: number;
    finalCoverage: EvidenceCoverageAssessment;
    planningRounds: number;
    stopReason: EvidenceGatherStopReason;
    budgetUsage: EvidenceBudgetUsage;
  };
  sources: AuditContextSource[];
  framework: typeof GROWTH_READINESS_FRAMEWORK;
  engineVersion: string;
};

type BuildAuditContextPackInput = {
  reportId?: string;
  url: string;
  auditTimestamp: string;
  identity: AuditContextPackV1["companyIdentity"];
  audit: Record<string, unknown>;
  overallScore: number;
  sources: EvidenceSourceReference[];
  evidenceDigests?: SemanticEvidenceDigest[];
  finalCoverage: EvidenceCoverageAssessment;
  planningRounds: number;
  stopReason: EvidenceGatherStopReason;
  budgetUsage: EvidenceBudgetUsage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compactText(value: unknown, maxChars = MAX_CONTEXT_TEXT_CHARS): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function compactTextArray(
  value: unknown,
  maxItems: number,
  maxChars = MAX_CONTEXT_TEXT_CHARS
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => compactText(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function deterministicSignals(signals?: EvidenceSignals): string[] {
  if (!signals) return [];
  const result = [
    `word_count:${signals.wordCount}`,
    `heading_count:${signals.headingCount}`,
  ];
  if (signals.hasPricingLanguage) result.push("pricing_language_present");
  if (signals.hasCallToAction) result.push("call_to_action_present");
  if (signals.hasTrustSignals) result.push("trust_signals_present");
  if (signals.hasCompetitiveLanguage) result.push("competitive_language_present");
  if (signals.hasGrowthContent) result.push("growth_content_present");
  return result;
}

export function sanitizeEvidenceDigests(
  value: unknown,
  sources: EvidenceSourceReference[]
): SemanticEvidenceDigest[] {
  const allowed = new Set(sources.map((source) => source.sourceId));
  const accepted = new Map<EvidenceSourceId, SemanticEvidenceDigest>();

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item) || !allowed.has(item.sourceId as EvidenceSourceId)) {
        continue;
      }
      const sourceId = item.sourceId as EvidenceSourceId;
      if (accepted.has(sourceId)) continue;
      accepted.set(sourceId, {
        sourceId,
        keyFindings: compactTextArray(
          item.keyFindings,
          MAX_FINDINGS_PER_SOURCE,
          320
        ),
        relevantSignals: compactTextArray(
          item.relevantSignals,
          MAX_SIGNALS_PER_SOURCE,
          160
        ),
      });
    }
  }

  return sources.map((source) => {
    const digest = accepted.get(source.sourceId);
    return {
      sourceId: source.sourceId,
      keyFindings: digest?.keyFindings ?? [],
      relevantSignals:
        digest?.relevantSignals.length
          ? digest.relevantSignals
          : deterministicSignals(source.signals),
    };
  });
}

function pillarContext(value: unknown): AuditContextPillar {
  const pillar = isRecord(value) ? value : {};
  const rawScore = typeof pillar.score === "number" ? pillar.score : 0;
  return {
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    confidence: compactText(pillar.confidence, 40),
    reason: compactText(pillar.reason),
    strengths: compactTextArray(pillar.strengths, 5, 320),
    weaknesses: compactTextArray(pillar.weaknesses, 5, 320),
  };
}

function buildPillars(value: unknown): Record<PillarKey, AuditContextPillar> {
  const pillars = isRecord(value) ? value : {};
  return Object.fromEntries(
    (Object.keys(PILLAR_WEIGHTS) as PillarKey[]).map((key) => [
      key,
      pillarContext(pillars[key]),
    ])
  ) as Record<PillarKey, AuditContextPillar>;
}

function buildPriorityMatrix(value: unknown): AuditContextPackV1["priorityMatrix"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .slice(0, 10)
    .map((item) => ({
      task: compactText(item.task, 240),
      impact: compactText(item.impact, 80),
      effort: compactText(item.effort, 80),
      why: compactText(item.why, 320),
    }));
}

export function buildAuditContextPack(
  input: BuildAuditContextPackInput
): AuditContextPackV1 {
  const verdict = isRecord(input.audit.the_verdict)
    ? input.audit.the_verdict
    : {};
  const digests = sanitizeEvidenceDigests(input.evidenceDigests, input.sources);
  const digestById = new Map(digests.map((digest) => [digest.sourceId, digest]));
  const parsedUrl = new URL(input.url);

  return {
    version: 1,
    ...(input.reportId ? { reportId: input.reportId } : {}),
    audited: {
      url: parsedUrl.href,
      domain: parsedUrl.hostname,
      timestamp: input.auditTimestamp,
    },
    companyIdentity: {
      company_name: compactText(input.identity.company_name, 160),
      inferred_description: compactText(
        input.identity.inferred_description,
        500
      ),
      target_audience: compactText(input.identity.target_audience, 320),
      primary_cta: compactText(input.identity.primary_cta, 160),
    },
    outcome: {
      overallScore: input.overallScore,
      scoreInterpretation: compactText(input.audit.score_interpretation, 700),
      finalVerdict: {
        status: compactText(verdict.status, 120),
        primary_constraint: compactText(verdict.primary_constraint, 500),
        highest_opportunity: compactText(verdict.highest_opportunity, 500),
        estimated_impact: compactText(verdict.estimated_impact, 500),
      },
    },
    pillars: buildPillars(input.audit.pillars),
    priorityMatrix: buildPriorityMatrix(input.audit.priority_matrix),
    investigation: {
      pagesInspected: input.budgetUsage.pagesInspected,
      finalCoverage: { ...input.finalCoverage },
      planningRounds: input.planningRounds,
      stopReason: input.stopReason,
      budgetUsage: { ...input.budgetUsage },
    },
    sources: input.sources.map((source) => {
      const digest = digestById.get(source.sourceId);
      return {
        ...source,
        ...(source.signals ? { signals: { ...source.signals } } : {}),
        keyFindings: [...(digest?.keyFindings ?? [])],
        relevantSignals: [...(digest?.relevantSignals ?? [])],
      };
    }),
    framework: GROWTH_READINESS_FRAMEWORK,
    engineVersion: VERDICT_ENGINE_VERSION,
  };
}

export function parseAuditContextPack(
  value: unknown
): AuditContextPackV1 | null {
  if (!isRecord(value) || value.version !== 1) return null;
  return value as AuditContextPackV1;
}
