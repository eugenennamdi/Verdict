export const EVIDENCE_CATEGORIES = [
  "identity",
  "positioning",
  "messaging",
  "conversion",
  "trust",
  "market",
  "growth",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export type EvidencePageStatus = "acquired" | "failed" | "skipped";

export type EvidenceAcquisitionMethod =
  | "provided"
  | "firecrawl"
  | "jina"
  | "native"
  | "none";

export type EvidencePage = {
  url: string;
  path: string;
  role: "homepage" | "supporting";
  category?: EvidenceCategory;
  acquisitionMethod: EvidenceAcquisitionMethod;
  markdown: string;
  chars: number;
  status: EvidencePageStatus;
  error?: string;
  signals?: Record<string, string | number | boolean>;
};

export type EvidencePageSummary = Omit<
  EvidencePage,
  "markdown" | "error" | "signals"
>;

export type EvidenceCoverage = {
  pagesTotal: number;
  pagesAcquired: number;
  pagesFailed: number;
  charsTotal: number;
  categories: Partial<Record<EvidenceCategory, number>>;
};

export type AuditBudget = {
  maxPagesTotal: number;
  maxPlanningRounds: number;
  maxUrlsPerRound: number;
  maxEvidenceChars: number;
  gatherTimeoutMs: number;
};

function normalizedUrlParts(rawUrl: string): { url: string; path: string } {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }
    return { url: parsed.href, path: parsed.pathname };
  } catch {
    return { url: rawUrl, path: "" };
  }
}

export function createEvidencePage(input: {
  url: string;
  role: EvidencePage["role"];
  category?: EvidenceCategory;
  acquisitionMethod?: EvidenceAcquisitionMethod;
  markdown?: string;
  status: EvidencePageStatus;
  error?: string;
}): EvidencePage {
  const normalized = normalizedUrlParts(input.url);
  const markdown = input.markdown ?? "";

  return {
    url: normalized.url,
    path: normalized.path,
    role: input.role,
    ...(input.category ? { category: input.category } : {}),
    acquisitionMethod: input.acquisitionMethod ?? "none",
    markdown,
    chars: markdown.length,
    status: input.status,
    ...(input.error ? { error: input.error } : {}),
  };
}

/**
 * Phase 3 hard ceilings. Overrides may reduce these limits, never raise them.
 */
export const DEFAULT_AUDIT_BUDGET: Readonly<AuditBudget> = Object.freeze({
  maxPagesTotal: 5,
  maxPlanningRounds: 3,
  maxUrlsPerRound: 2,
  maxEvidenceChars: 80_000,
  gatherTimeoutMs: 40_000,
});

function constrainedInteger(
  value: number | undefined,
  fallback: number,
  ceiling: number
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(ceiling, Math.max(1, Math.floor(value)));
}

export function resolveAuditBudget(
  overrides: Partial<AuditBudget> = {}
): AuditBudget {
  return {
    maxPagesTotal: constrainedInteger(
      overrides.maxPagesTotal,
      DEFAULT_AUDIT_BUDGET.maxPagesTotal,
      DEFAULT_AUDIT_BUDGET.maxPagesTotal
    ),
    maxPlanningRounds: constrainedInteger(
      overrides.maxPlanningRounds,
      DEFAULT_AUDIT_BUDGET.maxPlanningRounds,
      DEFAULT_AUDIT_BUDGET.maxPlanningRounds
    ),
    maxUrlsPerRound: constrainedInteger(
      overrides.maxUrlsPerRound,
      DEFAULT_AUDIT_BUDGET.maxUrlsPerRound,
      DEFAULT_AUDIT_BUDGET.maxUrlsPerRound
    ),
    maxEvidenceChars: constrainedInteger(
      overrides.maxEvidenceChars,
      DEFAULT_AUDIT_BUDGET.maxEvidenceChars,
      DEFAULT_AUDIT_BUDGET.maxEvidenceChars
    ),
    gatherTimeoutMs: constrainedInteger(
      overrides.gatherTimeoutMs,
      DEFAULT_AUDIT_BUDGET.gatherTimeoutMs,
      DEFAULT_AUDIT_BUDGET.gatherTimeoutMs
    ),
  };
}

export function remainingPageSlots(
  budget: AuditBudget,
  pagesUsed: number
): number {
  return Math.max(0, budget.maxPagesTotal - Math.max(0, pagesUsed));
}

export function remainingEvidenceChars(
  budget: AuditBudget,
  charsUsed: number
): number {
  return Math.max(0, budget.maxEvidenceChars - Math.max(0, charsUsed));
}

export function limitEvidenceMarkdown(
  markdown: string,
  budget: AuditBudget,
  charsUsed: number
): string {
  return markdown.slice(0, remainingEvidenceChars(budget, charsUsed));
}

export function canAcquireEvidence(
  budget: AuditBudget,
  pagesUsed: number,
  charsUsed: number
): boolean {
  return (
    remainingPageSlots(budget, pagesUsed) > 0 &&
    remainingEvidenceChars(budget, charsUsed) > 0
  );
}

export function summarizeEvidencePage(
  page: EvidencePage
): EvidencePageSummary {
  const {
    url,
    path,
    role,
    category,
    acquisitionMethod,
    chars,
    status,
  } = page;
  return {
    url,
    path,
    role,
    ...(category ? { category } : {}),
    acquisitionMethod,
    chars,
    status,
  };
}

export function summarizeEvidenceCoverage(
  pages: EvidencePage[]
): EvidenceCoverage {
  const categories: EvidenceCoverage["categories"] = {};

  for (const page of pages) {
    if (page.status === "acquired" && page.category) {
      categories[page.category] = (categories[page.category] ?? 0) + 1;
    }
  }

  return {
    pagesTotal: pages.length,
    pagesAcquired: pages.filter((page) => page.status === "acquired").length,
    pagesFailed: pages.filter((page) => page.status === "failed").length,
    charsTotal: pages.reduce((total, page) => total + page.chars, 0),
    categories,
  };
}
