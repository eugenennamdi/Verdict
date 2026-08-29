import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSafeAuditUrl: vi.fn(async (raw: string) => new URL(raw)),
  fetchContextDetailed: vi.fn(async () => ({
    markdown: "A sufficiently detailed homepage used as deterministic test evidence.",
    method: "firecrawl" as const,
  })),
  identifyFromMarkdown: vi.fn(async () => ({
    company_name: "Example",
    inferred_description: "Example product",
    target_audience: "Example teams",
    primary_cta: "Start now",
  })),
  gradeFromMarkdown: vi.fn(async () => ({
    company_name: "Example",
    overallScore: 73,
    score_interpretation: "Ready",
    pillars: {},
    the_verdict: {},
    priority_matrix: [],
  })),
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
}));

vi.mock("@/lib/audit/persist", () => ({
  persistReport: mocks.persistReport,
}));

import { runVerdictAudit } from "./runVerdictAudit";

describe("runVerdictAudit homepage-only regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses homepage evidence without selecting or acquiring extra pages", async () => {
    const result = await runVerdictAudit({
      url: "https://example.com",
      persist: false,
    });

    expect(result.overallScore).toBe(73);
    expect(result.evidence).toEqual([
      {
        url: "https://example.com/",
        path: "/",
        role: "homepage",
        category: "identity",
        acquisitionMethod: "firecrawl",
        chars: 69,
        status: "acquired",
      },
    ]);
    expect(result.evidence[0]).not.toHaveProperty("markdown");
    expect(result.trace.map((event) => event.type)).toEqual([
      "audit.started",
      "site.homepage_acquired",
      "startup.identified",
      "scoring.started",
      "audit.completed",
    ]);
    expect(mocks.fetchContextDetailed).toHaveBeenCalledTimes(1);
    expect(mocks.persistReport).not.toHaveBeenCalled();
  });
});
