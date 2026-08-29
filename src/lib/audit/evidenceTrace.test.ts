import { describe, expect, it } from "vitest";
import { createEvidencePage, type EvidenceCoverageAssessment } from "./evidence";
import { serializeEvidenceTrace } from "./evidenceTrace";

const coverage: EvidenceCoverageAssessment = {
  identity: "medium",
  positioning: "medium",
  messaging: "medium",
  conversion: "high",
  trust: "low",
  market: "low",
  growth: "low",
};

describe("evidence trace serialization", () => {
  it("retains compact provenance while excluding markdown and failed sources", () => {
    const trace = serializeEvidenceTrace({
      pages: [
        createEvidencePage({
          url: "https://example.com",
          role: "homepage",
          category: "identity",
          acquisitionMethod: "firecrawl",
          markdown: "PRIVATE_FULL_MARKDOWN pricing and get started",
          status: "acquired",
        }),
        createEvidencePage({
          url: "https://example.com/security",
          role: "supporting",
          category: "trust",
          status: "failed",
          error: "PRIVATE_FETCH_ERROR",
        }),
      ],
      coverage,
      planningRounds: 2,
      pageAttempts: 2,
      budget: {
        maxPagesTotal: 5,
        maxPlanningRounds: 3,
        maxUrlsPerRound: 2,
        maxEvidenceChars: 80_000,
        gatherTimeoutMs: 40_000,
      },
      stopReason: "page_budget",
    });

    expect(trace.pages).toHaveLength(1);
    expect(trace.pages[0].status).toBe("acquired");
    expect(trace.coverage).toEqual(coverage);
    expect(trace.stopReason).toBe("page_budget");
    expect(trace.budget).toMatchObject({
      pagesInspected: 1,
      pagesUsed: 2,
      evidenceChars: 45,
      maxEvidenceChars: 80_000,
    });
    expect(JSON.stringify(trace)).not.toContain("markdown");
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_FULL_MARKDOWN");
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_FETCH_ERROR");
  });
});
