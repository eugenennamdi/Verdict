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

export type EvidenceSignals = {
  wordCount: number;
  headingCount: number;
  hasPricingLanguage: boolean;
  hasCallToAction: boolean;
  hasTrustSignals: boolean;
  hasCompetitiveLanguage: boolean;
  hasGrowthContent: boolean;
};

export type EvidencePage = {
  url: string;
  path: string;
  role: "homepage" | "supporting";
  category?: EvidenceCategory;
  acquisitionMethod: EvidenceAcquisitionMethod;
  markdown: string;
  chars: number;
  status: EvidencePageStatus;
  summary?: string;
  signals?: EvidenceSignals;
  error?: string;
};

export type EvidencePageSummary = Omit<
  EvidencePage,
  "markdown" | "error"
>;

export type EvidenceCoverageLevel = "low" | "medium" | "high";

export type EvidenceCoverageAssessment = Record<
  EvidenceCategory,
  EvidenceCoverageLevel
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

export function extractCompactEvidence(markdown: string): {
  summary: string;
  signals: EvidenceSignals;
} {
  const normalized = markdown.replace(/\s+/g, " ").trim();
  const words = normalized ? normalized.split(" ") : [];
  const headingCount = (markdown.match(/^#{1,6}\s+/gm) ?? []).length;

  return {
    summary: normalized.slice(0, 240),
    signals: {
      wordCount: words.length,
      headingCount,
      hasPricingLanguage:
        /\b(pricing|price|plans?|per month|monthly|annual|\/mo)\b/i.test(
          normalized
        ),
      hasCallToAction:
        /\b(get started|start now|sign up|signup|book a demo|try (?:it )?free|contact sales)\b/i.test(
          normalized
        ),
      hasTrustSignals:
        /\b(customers?|testimonials?|trusted by|security|soc 2|case stud(?:y|ies)|reviews?)\b/i.test(
          normalized
        ),
      hasCompetitiveLanguage:
        /\b(compare|versus|vs\.?|alternatives?|competitors?|differentiat(?:e|ion))\b/i.test(
          normalized
        ),
      hasGrowthContent:
        /\b(blog|docs|changelog|integrations?|community|partners?|newsletter)\b/i.test(
          normalized
        ),
    },
  };
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
  const compact =
    input.status === "acquired" && markdown
      ? extractCompactEvidence(markdown)
      : undefined;

  return {
    url: normalized.url,
    path: normalized.path,
    role: input.role,
    ...(input.category ? { category: input.category } : {}),
    acquisitionMethod: input.acquisitionMethod ?? "none",
    markdown,
    chars: markdown.length,
    status: input.status,
    ...(compact ? compact : {}),
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
    summary,
    signals,
  } = page;
  return {
    url,
    path,
    role,
    ...(category ? { category } : {}),
    acquisitionMethod,
    chars,
    status,
    ...(summary ? { summary } : {}),
    ...(signals ? { signals } : {}),
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

export function assessEvidenceCoverage(
  pages: EvidencePage[]
): EvidenceCoverageAssessment {
  const coverage: EvidenceCoverageAssessment = {
    identity: "low",
    positioning: "low",
    messaging: "low",
    conversion: "low",
    trust: "low",
    market: "low",
    growth: "low",
  };

  for (const page of pages) {
    if (page.status !== "acquired") continue;

    if (page.role === "homepage") {
      coverage.identity = "medium";
      coverage.positioning = "medium";
      coverage.messaging = "medium";
    }

    if (page.category) {
      coverage[page.category] =
        page.role === "homepage" ? "medium" : "high";
    }

    if (page.signals?.hasPricingLanguage || page.signals?.hasCallToAction) {
      if (coverage.conversion === "low") coverage.conversion = "medium";
    }
    if (page.signals?.hasTrustSignals && coverage.trust === "low") {
      coverage.trust = "medium";
    }
    if (page.signals?.hasCompetitiveLanguage && coverage.market === "low") {
      coverage.market = "medium";
    }
    if (page.signals?.hasGrowthContent && coverage.growth === "low") {
      coverage.growth = "medium";
    }
  }

  return coverage;
}

export function isEvidenceCoverageSufficient(
  coverage: EvidenceCoverageAssessment
): boolean {
  return EVIDENCE_CATEGORIES.every((category) => coverage[category] !== "low");
}
