import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIT_BUDGET,
  canAcquireEvidence,
  createEvidencePage,
  limitEvidenceMarkdown,
  remainingEvidenceChars,
  remainingPageSlots,
  resolveAuditBudget,
  summarizeEvidenceCoverage,
  summarizeEvidencePage,
  isEvidenceCoverageSufficient,
} from "./evidence";

describe("audit budget", () => {
  it("exposes the Phase 3 hard defaults", () => {
    expect(DEFAULT_AUDIT_BUDGET).toEqual({
      maxPagesTotal: 5,
      maxPlanningRounds: 3,
      maxUrlsPerRound: 2,
      maxEvidenceChars: 80_000,
      gatherTimeoutMs: 40_000,
    });
  });

  it("allows reductions but clamps overrides to the hard ceilings", () => {
    expect(
      resolveAuditBudget({
        maxPagesTotal: 1,
        maxPlanningRounds: 99,
        maxUrlsPerRound: 99,
        maxEvidenceChars: 1_000,
        gatherTimeoutMs: 5_000,
      })
    ).toEqual({
      maxPagesTotal: 1,
      maxPlanningRounds: 3,
      maxUrlsPerRound: 2,
      maxEvidenceChars: 1_000,
      gatherTimeoutMs: 5_000,
    });
  });

  it("enforces page and character caps", () => {
    const budget = resolveAuditBudget({
      maxPagesTotal: 2,
      maxEvidenceChars: 5,
    });

    expect(remainingPageSlots(budget, 2)).toBe(0);
    expect(remainingEvidenceChars(budget, 3)).toBe(2);
    expect(canAcquireEvidence(budget, 2, 0)).toBe(false);
    expect(canAcquireEvidence(budget, 1, 5)).toBe(false);
    expect(limitEvidenceMarkdown("abcdefgh", budget, 3)).toBe("ab");
  });
});

describe("evidence page", () => {
  it("represents homepage evidence and keeps markdown out of summaries", () => {
    const homepage = createEvidencePage({
      url: "https://example.com/#hero",
      role: "homepage",
      category: "identity",
      acquisitionMethod: "provided",
      markdown: "homepage evidence",
      status: "acquired",
    });

    expect(homepage).toMatchObject({
      url: "https://example.com/",
      path: "/",
      role: "homepage",
      category: "identity",
      acquisitionMethod: "provided",
      markdown: "homepage evidence",
      chars: 17,
      status: "acquired",
    });
    const summary = summarizeEvidencePage(homepage);
    expect(summary).not.toHaveProperty("markdown");
    expect(summary.summary).toBe("homepage evidence");
    expect(summary.signals?.wordCount).toBe(2);
  });

  it("does not call homepage-only medium coverage sufficient", () => {
    const allMedium = {
      identity: "medium",
      positioning: "medium",
      messaging: "medium",
      conversion: "medium",
      trust: "medium",
      market: "medium",
      growth: "medium",
    } as const;

    expect(isEvidenceCoverageSufficient(allMedium)).toBe(false);
    expect(
      isEvidenceCoverageSufficient({ ...allMedium, conversion: "high" })
    ).toBe(true);
  });

  it("summarizes coverage without claiming sufficiency", () => {
    const acquired = createEvidencePage({
      url: "https://example.com/pricing",
      role: "supporting",
      category: "conversion",
      acquisitionMethod: "firecrawl",
      markdown: "1234",
      status: "acquired",
    });
    const failed = createEvidencePage({
      url: "https://example.com/security",
      role: "supporting",
      category: "trust",
      status: "failed",
    });

    expect(summarizeEvidenceCoverage([acquired, failed])).toEqual({
      pagesTotal: 2,
      pagesAcquired: 1,
      pagesFailed: 1,
      charsTotal: 4,
      categories: { conversion: 1 },
    });
  });
});
