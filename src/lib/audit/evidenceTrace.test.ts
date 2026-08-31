import { describe, expect, it } from "vitest";
import { createEvidencePage, type EvidenceCoverageAssessment } from "./evidence";
import { serializeEvidenceTrace } from "./evidenceTrace";
import { buildGraderEvidencePack } from "./source";

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
    const pages = [
        createEvidencePage({
          url: "https://example.com",
          role: "homepage",
          category: "identity",
          acquisitionMethod: "firecrawl",
          markdown: "PRIVATE_FULL_MARKDOWN pricing and get started",
          status: "acquired",
        }),
        createEvidencePage({
          url: "https://example.com/team/unrelated",
          role: "supporting",
          category: "identity",
          acquisitionMethod: "firecrawl",
          markdown: "PRIVATE_REJECTED_MARKDOWN",
          status: "acquired",
          admission: {
            status: "rejected_irrelevant",
            method: "model",
            reasonCode: "unrelated_entity",
          },
        }),
        createEvidencePage({
          url: "https://example.com/security",
          role: "supporting",
          category: "trust",
          status: "failed",
          error: "PRIVATE_FETCH_ERROR",
        }),
      ];
    const trace = serializeEvidenceTrace({
      pages,
      coverage,
      planningRounds: 2,
      pageAttempts: 3,
      budget: {
        maxPagesTotal: 5,
        maxPlanningRounds: 3,
        maxUrlsPerRound: 2,
        maxEvidenceChars: 80_000,
        gatherTimeoutMs: 40_000,
      },
      stopReason: "page_budget",
      graderSources: buildGraderEvidencePack(pages).sources,
    });

    expect(trace.pages).toHaveLength(1);
    expect(trace.pages[0].status).toBe("acquired");
    expect(trace.coverage).toEqual(coverage);
    expect(trace.stopReason).toBe("page_budget");
    expect(trace.budget).toMatchObject({
      pagesInspected: 2,
      pagesAccepted: 1,
      pagesRejected: 1,
      pagesFailed: 1,
      pagesUsed: 3,
      evidenceChars: 45,
      fetchedEvidenceChars: 70,
      maxEvidenceChars: 80_000,
    });
    expect(trace.rejectedPages).toEqual([
      expect.objectContaining({
        url: "https://example.com/team/unrelated",
        status: "rejected_irrelevant",
        reasonCode: "unrelated_entity",
      }),
    ]);
    expect(trace.failedPages).toEqual([
      expect.objectContaining({
        url: "https://example.com/security",
        status: "failed",
      }),
    ]);
    expect(JSON.stringify(trace)).not.toContain("markdown");
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_FULL_MARKDOWN");
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_FETCH_ERROR");
    expect(JSON.stringify(trace)).not.toContain("PRIVATE_REJECTED_MARKDOWN");
  });
});
