import {
  projectCanonicalReportFacts,
  type CanonicalReportProjection,
} from "@/lib/audit/canonicalReport";
import type { AuditSummary, RecentInvestigation } from "./types";

type FetchCanonicalFacts = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function scoreFreePillars(
  pillars: AuditSummary["pillars"]
): AuditSummary["pillars"] {
  if (!pillars) return undefined;

  return Object.fromEntries(
    Object.entries(pillars).map(([key, pillar]) => [
      key,
      {
        ...(pillar.confidence ? { confidence: pillar.confidence } : {}),
        ...(pillar.reason ? { reason: pillar.reason } : {}),
        ...(pillar.strengths ? { strengths: [...pillar.strengths] } : {}),
        ...(pillar.weaknesses ? { weaknesses: [...pillar.weaknesses] } : {}),
      },
    ])
  );
}

export function hasCanonicalDimensionRanking(
  projection: CanonicalReportProjection | undefined
): boolean {
  return Boolean(
    projection?.strongestDimension && projection.weakestDimension
  );
}

function normalizeProjection(
  value: unknown,
  reportId: string
): CanonicalReportProjection | undefined {
  if (!isRecord(value)) return undefined;

  const normalized = projectCanonicalReportFacts({
    reportId,
    canonicalReportFacts: value,
  });

  if (
    value.dimensionRankingAvailable === true &&
    !normalized.dimensionRankingAvailable
  ) {
    return undefined;
  }

  return normalized;
}

/**
 * Hydrates a score-free Recent Audits snapshot from the authoritative persisted
 * report. The response is intentionally limited to canonical qualitative facts;
 * internal pillar scores never enter the workspace cache.
 */
export async function hydrateRecentCanonicalFacts(
  item: RecentInvestigation,
  fetchCanonicalFacts: FetchCanonicalFacts = fetch
): Promise<RecentInvestigation> {
  const existingProjection = item.result?.canonicalReportFacts;
  const existingMatchesReport = Boolean(
    item.reportId &&
      (!item.result?.reportId || item.result.reportId === item.reportId) &&
      (!existingProjection?.reportId ||
        existingProjection.reportId === item.reportId)
  );

  if (
    !item.result ||
    !item.reportId ||
    (existingMatchesReport &&
      hasCanonicalDimensionRanking(existingProjection))
  ) {
    return item;
  }

  try {
    const response = await fetchCanonicalFacts(
      `/api/report/${encodeURIComponent(item.reportId)}?view=canonical`
    );
    if (!response.ok) return item;

    const payload = (await response.json()) as unknown;
    if (
      !isRecord(payload) ||
      payload.reportId !== item.reportId
    ) {
      return item;
    }

    const canonicalReportFacts = normalizeProjection(
      payload.canonicalReportFacts,
      item.reportId
    );
    if (!canonicalReportFacts) return item;

    return {
      ...item,
      result: {
        ...item.result,
        reportId: item.reportId,
        canonicalReportFacts,
      },
    };
  } catch {
    return item;
  }
}
