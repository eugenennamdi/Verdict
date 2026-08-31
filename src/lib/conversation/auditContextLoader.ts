import "server-only";

import {
  buildAuditContextPack,
  parseAuditContextPack,
  type AuditContextPackV1,
} from "@/lib/audit/auditContext";
import {
  EVIDENCE_CATEGORIES,
  type EvidenceAcquisitionMethod,
  type EvidenceCategory,
  type EvidenceCoverageAssessment,
} from "@/lib/audit/evidence";
import type { EvidenceBudgetUsage, EvidenceTrace } from "@/lib/audit/evidenceTrace";
import type { EvidenceGatherStopReason } from "@/lib/audit/gather";
import type {
  EvidenceSourceId,
  EvidenceSourceReference,
} from "@/lib/audit/source";
import { PILLAR_WEIGHTS } from "@/lib/audit/score";
import { supabaseAdmin } from "@/lib/supabase";

const REPORT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STOP_REASONS = new Set<EvidenceGatherStopReason>([
  "sufficient",
  "page_budget",
  "planning_round_budget",
  "character_budget",
  "gather_timeout",
  "discovery_failed",
  "no_candidates",
  "no_selection",
]);

const ACQUISITION_METHODS = new Set<EvidenceAcquisitionMethod>([
  "provided",
  "firecrawl",
  "jina",
  "native",
  "none",
]);

type PersistedReportContextRow = {
  id: string;
  company_name?: unknown;
  url?: unknown;
  fdi_overall_score?: unknown;
  executive_summary?: unknown;
  top_5_priorities?: unknown;
  key_risks?: unknown;
  growth_plan_30_day?: unknown;
  evidence_trace?: unknown;
  audit_context?: unknown;
  created_at?: unknown;
};

export type LoadedAuditContext = {
  reportId: string;
  context: AuditContextPackV1;
  provenance: "audit_context" | "legacy_fallback";
  sourceSemanticsAvailable: boolean;
};

export class AuditContextLoadError extends Error {
  constructor(message: "Invalid report reference" | "Unable to load report") {
    super(message);
    this.name = "AuditContextLoadError";
  }
}

export type AuditContextLookup = (
  reportId: string
) => Promise<{ data: PersistedReportContextRow | null; error?: unknown }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function emptyCoverage(): EvidenceCoverageAssessment {
  return Object.fromEntries(
    EVIDENCE_CATEGORIES.map((category) => [category, "low"])
  ) as EvidenceCoverageAssessment;
}

function parseCoverage(value: unknown): EvidenceCoverageAssessment {
  if (!isRecord(value)) return emptyCoverage();
  const result = emptyCoverage();
  for (const category of EVIDENCE_CATEGORIES) {
    const level = value[category];
    if (level === "low" || level === "medium" || level === "high") {
      result[category] = level;
    }
  }
  return result;
}

function parseStopReason(value: unknown): EvidenceGatherStopReason {
  return typeof value === "string" &&
    STOP_REASONS.has(value as EvidenceGatherStopReason)
    ? (value as EvidenceGatherStopReason)
    : "no_candidates";
}

function sourceReferences(value: unknown): EvidenceSourceReference[] {
  if (!isRecord(value) || !Array.isArray(value.pages)) return [];
  const sources = value.pages.flatMap((item) => {
    if (!isRecord(item) || typeof item.url !== "string") return [];
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return [];
      const category = EVIDENCE_CATEGORIES.includes(
        item.category as EvidenceCategory
      )
        ? (item.category as EvidenceCategory)
        : undefined;
      const method = ACQUISITION_METHODS.has(
        item.acquisitionMethod as EvidenceAcquisitionMethod
      )
        ? (item.acquisitionMethod as EvidenceAcquisitionMethod)
        : "none";
      return [
        {
          sourceId: "S0" as const,
          url: url.href,
          path:
            typeof item.path === "string" ? item.path : url.pathname || "/",
          role:
            item.role === "supporting"
              ? ("supporting" as const)
              : ("homepage" as const),
          ...(category ? { category } : {}),
          acquisitionMethod: method,
          chars: Math.max(0, Math.round(finiteNumber(item.chars, 0))),
        },
      ];
    } catch {
      return [];
    }
  });
  return sources.map((source, index) => ({
    ...source,
    sourceId: `S${index + 1}` as EvidenceSourceId,
  }));
}

function budgetUsage(
  trace: unknown,
  sources: EvidenceSourceReference[]
): EvidenceBudgetUsage {
  const raw = isRecord(trace) && isRecord(trace.budget) ? trace.budget : {};
  const evidenceChars = sources.reduce((total, source) => total + source.chars, 0);
  return {
    pagesInspected: Math.max(
      0,
      Math.round(finiteNumber(raw.pagesInspected, sources.length))
    ),
    ...(typeof raw.pagesAccepted === "number"
      ? {
          pagesAccepted: Math.max(0, Math.round(raw.pagesAccepted)),
        }
      : {}),
    ...(typeof raw.pagesRejected === "number"
      ? {
          pagesRejected: Math.max(0, Math.round(raw.pagesRejected)),
        }
      : {}),
    ...(typeof raw.pagesFailed === "number"
      ? {
          pagesFailed: Math.max(0, Math.round(raw.pagesFailed)),
        }
      : {}),
    pagesUsed: Math.max(
      0,
      Math.round(finiteNumber(raw.pagesUsed, sources.length))
    ),
    maxPages: Math.max(1, Math.round(finiteNumber(raw.maxPages, 5))),
    evidenceChars: Math.max(
      0,
      Math.round(finiteNumber(raw.evidenceChars, evidenceChars))
    ),
    ...(typeof raw.fetchedEvidenceChars === "number"
      ? {
          fetchedEvidenceChars: Math.max(
            0,
            Math.round(raw.fetchedEvidenceChars)
          ),
        }
      : {}),
    maxEvidenceChars: Math.max(
      1,
      Math.round(finiteNumber(raw.maxEvidenceChars, 80_000))
    ),
    planningRounds: Math.max(
      0,
      Math.round(finiteNumber(raw.planningRounds, 0))
    ),
    maxPlanningRounds: Math.max(
      1,
      Math.round(finiteNumber(raw.maxPlanningRounds, 3))
    ),
    gatherTimeoutMs: Math.max(
      1,
      Math.round(finiteNumber(raw.gatherTimeoutMs, 40_000))
    ),
  };
}

function usableAuditContext(value: unknown): AuditContextPackV1 | null {
  const parsed = parseAuditContextPack(value);
  if (
    !parsed ||
    !isRecord(parsed.audited) ||
    !isRecord(parsed.companyIdentity) ||
    !isRecord(parsed.outcome) ||
    !isRecord(parsed.pillars) ||
    !isRecord(parsed.investigation) ||
    !Array.isArray(parsed.sources) ||
    !Array.isArray(parsed.priorityMatrix)
  ) {
    return null;
  }
  const pillarsValid = Object.keys(PILLAR_WEIGHTS).every((key) => {
    const pillar = parsed.pillars[key as keyof typeof PILLAR_WEIGHTS];
    return isRecord(pillar) && Number.isFinite(pillar.score);
  });
  const sourcesValid = parsed.sources.every((source, index) => {
    if (
      !isRecord(source) ||
      source.sourceId !== `S${index + 1}` ||
      typeof source.url !== "string" ||
      !Array.isArray(source.keyFindings) ||
      !Array.isArray(source.relevantSignals)
    ) {
      return false;
    }
    try {
      const url = new URL(source.url);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });
  if (!pillarsValid || !sourcesValid) return null;
  return parsed;
}

export function buildLegacyAuditContext(
  row: PersistedReportContextRow
): AuditContextPackV1 {
  const url = stringValue(row.url, "https://invalid.example/");
  const trace = isRecord(row.evidence_trace)
    ? (row.evidence_trace as unknown as EvidenceTrace)
    : null;
  const sources = sourceReferences(trace);
  const budget = budgetUsage(trace, sources);
  const context = buildAuditContextPack({
    reportId: row.id,
    url,
    auditTimestamp: stringValue(row.created_at, "1970-01-01T00:00:00.000Z"),
    identity: {
      company_name: stringValue(row.company_name, "Unknown"),
      inferred_description: "",
      target_audience: "",
      primary_cta: "",
    },
    audit: {
      score_interpretation: stringValue(row.executive_summary),
      pillars: row.growth_plan_30_day,
      the_verdict: row.key_risks,
      priority_matrix: row.top_5_priorities,
    },
    overallScore: Math.max(
      0,
      Math.min(100, Math.round(finiteNumber(row.fdi_overall_score, 0)))
    ),
    sources,
    finalCoverage: parseCoverage(trace?.coverage),
    planningRounds: Math.max(
      0,
      Math.round(finiteNumber(trace?.planningRounds, budget.planningRounds))
    ),
    stopReason: parseStopReason(trace?.stopReason),
    budgetUsage: budget,
  });
  return context;
}

async function defaultLookup(
  reportId: string
): Promise<{ data: PersistedReportContextRow | null; error?: unknown }> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select(
      "id, company_name, url, fdi_overall_score, executive_summary, top_5_priorities, key_risks, growth_plan_30_day, evidence_trace, audit_context, created_at"
    )
    .eq("id", reportId)
    .maybeSingle();
  return { data: data as PersistedReportContextRow | null, error };
}

export async function loadAuditContext(
  reportId: string,
  options: { lookup?: AuditContextLookup } = {}
): Promise<LoadedAuditContext | null> {
  if (!REPORT_ID_PATTERN.test(reportId)) {
    throw new AuditContextLoadError("Invalid report reference");
  }

  let result: Awaited<ReturnType<AuditContextLookup>>;
  try {
    result = await (options.lookup ?? defaultLookup)(reportId);
  } catch {
    throw new AuditContextLoadError("Unable to load report");
  }
  if (result.error) {
    throw new AuditContextLoadError("Unable to load report");
  }
  if (!result.data) return null;

  const stored = usableAuditContext(result.data.audit_context);
  if (stored) {
    const context = { ...stored, reportId };
    return {
      reportId,
      context,
      provenance: "audit_context",
      sourceSemanticsAvailable: context.sources.some(
        (source) => source.keyFindings.length > 0
      ),
    };
  }

  return {
    reportId,
    context: buildLegacyAuditContext(result.data),
    provenance: "legacy_fallback",
    sourceSemanticsAvailable: false,
  };
}
