import { beforeEach, describe, expect, it, vi } from "vitest";

type ContextFetcherMock = (
  url: string,
  fallbackText?: string,
  options?: { maxChars?: number; timeoutMs?: number }
) => Promise<{ markdown: string; method: "firecrawl" }>;

type GradeMock = (
  url: string,
  markdown: string,
  options?: {
    sources?: Array<{ sourceId: string; url: string }>;
    deadlineAt?: number;
    onModelResult?: (
      task: "normalization" | "planner" | "grader" | "qa",
      metadata: {
        requestedPrimaryModel: "gemini-3.7-flash";
        provider: "google" | "deepseek";
        model:
          | "gemini-3.7-flash"
          | "gemini-3.6-flash"
          | "deepseek-v4-flash"
          | "deepseek-v4-pro";
        modelUsed:
          | "gemini-3.7-flash"
          | "gemini-3.6-flash"
          | "deepseek-v4-flash"
          | "deepseek-v4-pro";
        tier: "primary" | "secondary" | "tertiary";
        fallbackUsed: boolean;
      }
    ) => void;
  }
) => Promise<{
  company_name: string;
  overallScore: number;
  score_interpretation: string;
  pillars: Record<string, never>;
  the_verdict: Record<string, never>;
  priority_matrix: never[];
  evidenceDigests: Array<{
    sourceId: `S${number}`;
    keyFindings: string[];
    relevantSignals: string[];
  }>;
}>;

type DiscoveryMock = () => Promise<
  Array<{
    url: string;
    path: string;
    category?: "conversion" | "trust" | "positioning";
    ranking: { priority: number };
  }>
>;

type IdentifyMock = (
  markdown: string,
  options?: Parameters<GradeMock>[2]
) => Promise<{
  company_name: string;
  inferred_description: string;
  target_audience: string;
  primary_cta: string;
}>;

const mocks = vi.hoisted(() => ({
  assertSafeAuditUrl: vi.fn(async (raw: string) => new URL(raw)),
  fetchContextDetailed: vi.fn<ContextFetcherMock>(async () => ({
    markdown: "A sufficiently detailed homepage used as deterministic test evidence.",
    method: "firecrawl" as const,
  })),
  identifyFromMarkdown: vi.fn<IdentifyMock>(async (_markdown, options) => {
    options?.onModelResult?.("normalization", {
      requestedPrimaryModel: "gemini-3.7-flash",
      provider: "google",
      model: "gemini-3.7-flash",
      modelUsed: "gemini-3.7-flash",
      tier: "primary",
      fallbackUsed: false,
    });
    return {
      company_name: "Example",
      inferred_description: "Example product",
      target_audience: "Example teams",
      primary_cta: "Start now",
    };
  }),
  gradeFromMarkdown: vi.fn<GradeMock>(async (_url, _markdown, options) => {
    options?.onModelResult?.("grader", {
      requestedPrimaryModel: "gemini-3.7-flash",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      modelUsed: "deepseek-v4-pro",
      tier: "secondary",
      fallbackUsed: true,
    });
    return {
      company_name: "Example",
      overallScore: 73,
      score_interpretation: "Ready",
      pillars: {},
      the_verdict: {},
      priority_matrix: [],
      evidenceDigests: [],
    };
  }),
  generateStructuredJson: vi.fn(async () => {
    throw new Error("planner unavailable");
  }),
  discoverInternalPages: vi.fn<DiscoveryMock>(async () => []),
  admitEvidencePages: vi.fn(async (input: { pages: Array<Record<string, unknown>> }) =>
    input.pages.map((page) => ({
      ...page,
      admission: { status: "accepted", method: "model" },
    }))
  ),
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

vi.mock("@/lib/audit/admission", () => ({
  admitEvidencePages: mocks.admitEvidencePages,
}));

vi.mock("@/lib/audit/persist", () => ({
  persistReport: mocks.persistReport,
}));

import {
  AUDIT_FINALIZATION_HEADROOM_MS,
  DEFAULT_AUDIT_DEADLINE_MS,
  runVerdictAudit,
} from "./runVerdictAudit";

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
      candidatesRetained: 0,
      planningRounds: 0,
      pageAttempts: 1,
      stopReason: "page_budget",
    });
    expect(result.pagesInspected).toBe(1);
    expect(result.pagesAccepted).toBe(1);
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
      "--- UNTRUSTED WEBSITE EVIDENCE S1 ---"
    );
    expect(mocks.gradeFromMarkdown.mock.calls[0][2]).toMatchObject({
      sources: [
        expect.objectContaining({
          sourceId: "S1",
          url: "https://example.com/",
          role: "homepage",
        }),
      ],
    });
    expect(mocks.gradeFromMarkdown.mock.calls[0][2]?.deadlineAt).toEqual(
      expect.any(Number)
    );
    expect(result.auditContext.sources[0].sourceId).toBe("S1");
    expect(result.modelProvenance).toEqual({
      normalization: {
        requestedPrimaryModel: "gemini-3.7-flash",
        provider: "google",
        model: "gemini-3.7-flash",
        modelUsed: "gemini-3.7-flash",
        tier: "primary",
        fallbackUsed: false,
      },
      planner: [],
      admission: [],
      grader: {
        requestedPrimaryModel: "gemini-3.7-flash",
        provider: "deepseek",
        model: "deepseek-v4-pro",
        modelUsed: "deepseek-v4-pro",
        tier: "secondary",
        fallbackUsed: true,
      },
    });
    expect(result.auditContext.models).toEqual(result.modelProvenance);
  });

  it("enforces the overall audit deadline before acquisition or persistence", async () => {
    await expect(
      runVerdictAudit({
        url: "https://example.com",
        persist: true,
        deadlineAt: Date.now() - 1,
      })
    ).rejects.toMatchObject({ name: "ModelAvailabilityError", category: "timeout" });

    expect(mocks.fetchContextDetailed).not.toHaveBeenCalled();
    expect(mocks.gradeFromMarkdown).not.toHaveBeenCalled();
    expect(mocks.persistReport).not.toHaveBeenCalled();
  });

  it("keeps the audit deadline below the route envelope with finalization headroom", () => {
    expect(DEFAULT_AUDIT_DEADLINE_MS).toBe(200_000);
    expect(AUDIT_FINALIZATION_HEADROOM_MS).toBe(20_000);
    expect(DEFAULT_AUDIT_DEADLINE_MS).toBeLessThan(300_000);
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

  it("keeps a relevance-rejected fetch out of grading, trace evidence, and audit context", async () => {
    mocks.discoverInternalPages.mockResolvedValue([
      {
        url: "https://example.com/team/unrelated-business",
        path: "/team/unrelated-business",
        category: "trust",
        ranking: { priority: 90 },
      },
    ]);
    mocks.fetchContextDetailed.mockImplementation(async (url: string) => ({
      markdown: url.includes("unrelated-business")
        ? "A completely unrelated local business page"
        : "A sufficiently detailed homepage used as deterministic test evidence.",
      method: "firecrawl" as const,
    }));
    mocks.admitEvidencePages.mockImplementationOnce(async (input) =>
      input.pages.map((page) => ({
        ...page,
        admission: {
          status: "rejected_irrelevant",
          method: "model",
          reasonCode: "unrelated_entity",
        },
      }))
    );

    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: false,
      budget: { maxPagesTotal: 2 },
    });

    expect(result.pagesInspected).toBe(2);
    expect(result.pagesAccepted).toBe(1);
    expect(result.evidence.map((page) => page.url)).toEqual([
      "https://example.com/",
    ]);
    expect(result.evidenceTrace.pages).toHaveLength(1);
    expect(result.evidenceTrace.rejectedPages).toEqual([
      expect.objectContaining({
        url: "https://example.com/team/unrelated-business",
        reasonCode: "unrelated_entity",
      }),
    ]);
    expect(result.auditContext.sources.map((source) => source.url)).toEqual([
      "https://example.com/",
    ]);
    expect(mocks.gradeFromMarkdown.mock.calls.at(-1)?.[1]).not.toContain(
      "unrelated-business"
    );
  });

  it("preserves the normal three-page accepted audit shape", async () => {
    mocks.discoverInternalPages.mockResolvedValue([
      {
        url: "https://example.com/pricing",
        path: "/pricing",
        category: "conversion",
        ranking: { priority: 100 },
      },
      {
        url: "https://example.com/security",
        path: "/security",
        category: "trust",
        ranking: { priority: 90 },
      },
    ]);
    mocks.fetchContextDetailed.mockImplementation(async (url: string) => ({
      markdown: `Relevant Example evidence for ${url}`,
      method: "firecrawl" as const,
    }));

    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: false,
      budget: { maxPagesTotal: 3 },
    });

    expect(result.pagesInspected).toBe(3);
    expect(result.pagesAccepted).toBe(3);
    expect(result.auditContext.sources).toHaveLength(3);
    expect(result.evidenceTrace.pages).toHaveLength(3);
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
        auditContext: expect.objectContaining({
          version: 1,
          framework: expect.objectContaining({
            id: "verdict-growth-readiness",
          }),
          models: result.modelProvenance,
        }),
      })
    );
    expect(result.auditContext.reportId).toBe("report-1");
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

  it("keeps raw provider errors out of public activity events", async () => {
    const events: Array<{ type: string; data?: Record<string, unknown> }> = [];
    mocks.gradeFromMarkdown.mockRejectedValueOnce(
      new Error("provider unavailable raw body")
    );

    await expect(
      runVerdictAudit({
        url: "https://example.com",
        persist: false,
        budget: { maxPagesTotal: 1 },
        onEvent: (event) => events.push(event),
      })
    ).rejects.toThrow("provider unavailable raw body");

    expect(events.at(-1)).toMatchObject({
      type: "audit.failed",
      data: { error: "MODEL_TEMPORARILY_UNAVAILABLE" },
    });
    expect(JSON.stringify(events)).not.toContain("provider unavailable raw body");
  });
});
