import { beforeEach, describe, expect, it, vi } from "vitest";

type ContextFetcherMock = (
  url: string,
  fallbackText?: string,
  options?: { maxChars?: number; timeoutMs?: number }
) => Promise<{ markdown: string; method: "firecrawl" }>;

type GradeMock = (
  url: string,
  markdown: string
) => Promise<{
  company_name: string;
  overallScore: number;
  score_interpretation: string;
  pillars: Record<string, never>;
  the_verdict: Record<string, never>;
  priority_matrix: never[];
}>;

type DiscoveryMock = () => Promise<
  Array<{
    url: string;
    path: string;
    category?: "conversion";
    ranking: { priority: number };
  }>
>;

const mocks = vi.hoisted(() => ({
  assertSafeAuditUrl: vi.fn(async (raw: string) => new URL(raw)),
  fetchContextDetailed: vi.fn<ContextFetcherMock>(async () => ({
    markdown: "A sufficiently detailed homepage used as deterministic test evidence.",
    method: "firecrawl" as const,
  })),
  identifyFromMarkdown: vi.fn(async () => ({
    company_name: "Example",
    inferred_description: "Example product",
    target_audience: "Example teams",
    primary_cta: "Start now",
  })),
  gradeFromMarkdown: vi.fn<GradeMock>(async () => ({
    company_name: "Example",
    overallScore: 73,
    score_interpretation: "Ready",
    pillars: {},
    the_verdict: {},
    priority_matrix: [],
  })),
  generateStructuredJson: vi.fn(async () => {
    throw new Error("planner unavailable");
  }),
  discoverInternalPages: vi.fn<DiscoveryMock>(async () => []),
  persistReport: vi.fn(),
}));

vi.mock("@/lib/security/url", () => ({
  assertSafeAuditUrl: mocks.assertSafeAuditUrl,
}));

vi.mock("@/lib/engine", () => ({
  ScrapingError: class ScrapingError extends Error {},
  fetchContextDetailed: mocks.fetchContextDetailed,
  identifyFromMarkdown: mocks.identifyFromMarkdown,
  gradeFromMarkdown: mocks.gradeFromMarkdown,
  generateStructuredJson: mocks.generateStructuredJson,
}));

vi.mock("@/lib/audit/discover", () => ({
  discoverInternalPages: mocks.discoverInternalPages,
}));

vi.mock("@/lib/audit/persist", () => ({
  persistReport: mocks.persistReport,
}));

import { runVerdictAudit } from "./runVerdictAudit";

describe("runVerdictAudit homepage-only regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchContextDetailed.mockImplementation(async () => ({
      markdown: "A sufficiently detailed homepage used as deterministic test evidence.",
      method: "firecrawl" as const,
    }));
    mocks.discoverInternalPages.mockResolvedValue([]);
  });

  it("uses homepage evidence without selecting or acquiring extra pages", async () => {
    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: false,
      budget: { maxPagesTotal: 1 },
    });

    expect(result.overallScore).toBe(73);
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({
      url: "https://example.com/",
      path: "/",
      role: "homepage",
      category: "identity",
      acquisitionMethod: "firecrawl",
      chars: 69,
      status: "acquired",
    });
    expect(result.evidence[0]).not.toHaveProperty("markdown");
    expect(result.investigation).toEqual({
      candidatesDiscovered: 0,
      planningRounds: 0,
      pageAttempts: 1,
      stopReason: "page_budget",
    });
    expect(result.pagesInspected).toBe(1);
    expect(result.stopReason).toBe("page_budget");
    expect(result.budgetUsage).toMatchObject({
      pagesInspected: 1,
      pagesUsed: 1,
      maxPages: 1,
    });
    expect(result.finalCoverage.identity).toBe("medium");
    expect(result.trace.map((event) => event.type)).toEqual([
      "audit.started",
      "site.homepage_acquired",
      "startup.identified",
      "scoring.started",
      "audit.completed",
    ]);
    expect(mocks.fetchContextDetailed).toHaveBeenCalledTimes(1);
    expect(mocks.persistReport).not.toHaveBeenCalled();
    expect(mocks.gradeFromMarkdown.mock.calls[0][1]).toContain(
      "--- EVIDENCE PAGE 1 ---"
    );
  });

  it("continues to final grading when an additional page acquisition fails", async () => {
    mocks.discoverInternalPages.mockResolvedValue([
      {
        url: "https://example.com/pricing",
        path: "/pricing",
        category: "conversion",
        ranking: { priority: 100 },
      },
    ]);
    mocks.fetchContextDetailed.mockImplementation(async (url: string) => {
      if (url.endsWith("/pricing")) throw new Error("additional page failed");
      return {
        markdown: "A sufficiently detailed homepage used as deterministic test evidence.",
        method: "firecrawl" as const,
      };
    });

    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: false,
      budget: { maxPagesTotal: 2 },
    });

    expect(result.overallScore).toBe(73);
    expect(result.evidence.map((page) => page.status)).toEqual([
      "acquired",
      "failed",
    ]);
    expect(result.trace.some((event) => event.type === "audit.failed")).toBe(false);
    expect(result.trace.some((event) => event.type === "evidence.acquired")).toBe(false);
    expect(result.pagesInspected).toBe(1);
    expect(result.evidenceTrace.pages).toHaveLength(1);
    expect(mocks.gradeFromMarkdown).toHaveBeenCalledTimes(1);
  });

  it("persists compact evidence metadata including the stop reason", async () => {
    mocks.persistReport.mockResolvedValue("report-1");

    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: true,
      budget: { maxPagesTotal: 1 },
    });

    expect(result.reportId).toBe("report-1");
    expect(mocks.persistReport).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceTrace: expect.objectContaining({
          version: 1,
          stopReason: "page_budget",
          coverage: result.finalCoverage,
        }),
      })
    );
    expect(JSON.stringify(mocks.persistReport.mock.calls[0][0])).not.toContain("markdown");
  });

  it("completes a valid homepage audit when discovery is unavailable", async () => {
    mocks.discoverInternalPages.mockRejectedValue(new Error("map unavailable"));

    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: false,
    });

    expect(result.overallScore).toBe(73);
    expect(result.pagesInspected).toBe(1);
    expect(result.stopReason).toBe("discovery_failed");
    expect(result.trace.at(-1)?.type).toBe("audit.completed");
    expect(result.trace.some((item) => item.type === "audit.failed")).toBe(false);
  });
});
