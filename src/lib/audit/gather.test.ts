import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/engine", () => ({
  fetchContextDetailed: vi.fn(),
}));

import { createTracer } from "./events";
import type { EvidenceCandidate } from "./discover";
import {
  createEvidencePage,
  type EvidenceCoverageAssessment,
  type EvidencePage,
} from "./evidence";
import {
  combineEvidenceForGrading,
  gatherAuditEvidence,
  type EvidenceGatherServices,
} from "./gather";
import type { EvidencePlan, PlannedEvidenceSelection } from "./plan";

const identity = {
  company_name: "Example",
  inferred_description: "Example product",
  target_audience: "Teams",
  primary_cta: "Start",
};

const lowCoverage: EvidenceCoverageAssessment = {
  identity: "medium",
  positioning: "medium",
  messaging: "medium",
  conversion: "low",
  trust: "low",
  market: "low",
  growth: "low",
};

const candidates: EvidenceCandidate[] = [
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
  {
    url: "https://example.com/compare",
    path: "/compare",
    category: "market",
    ranking: { priority: 60 },
  },
];

function homepage(markdown = "Example homepage with a clear product message.") {
  return createEvidencePage({
    url: "https://example.com",
    role: "homepage",
    category: "identity",
    acquisitionMethod: "firecrawl",
    markdown,
    status: "acquired",
  });
}

function selection(candidate: EvidenceCandidate): PlannedEvidenceSelection {
  const category = candidate.category!;
  return {
    url: candidate.url,
    category,
    reasonCode: `${category}_evidence_needed`,
  };
}

function planFor(items: EvidenceCandidate[]): EvidencePlan {
  return {
    done: false,
    coverage: lowCoverage,
    missing: ["conversion", "trust", "market", "growth"],
    selections: items.map(selection),
    source: "model",
  };
}

function acquiredPage(url: string, category: EvidencePage["category"], text = "page evidence") {
  return createEvidencePage({
    url,
    role: "supporting",
    category,
    acquisitionMethod: "firecrawl",
    markdown: text,
    status: "acquired",
  });
}

function services(
  overrides: Partial<EvidenceGatherServices> = {}
): Partial<EvidenceGatherServices> {
  return {
    discover: async () => candidates,
    plan: async () => planFor([candidates[0]]),
    acquire: async (input) => acquiredPage(input.url, input.category),
    now: () => 0,
    ...overrides,
  };
}

describe("gatherAuditEvidence boundaries", () => {
  it("enforces the maximum page-attempt budget", async () => {
    const acquire = vi.fn(async (input) =>
      acquiredPage(input.url, input.category)
    );
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { maxPagesTotal: 2, maxUrlsPerRound: 2 },
      tracer: createTracer(),
      services: services({
        plan: async () => planFor(candidates.slice(0, 2)),
        acquire,
      }),
    });

    expect(acquire).toHaveBeenCalledTimes(1);
    expect(result.pageAttempts).toBe(2);
    expect(result.stopReason).toBe("page_budget");
  });

  it("enforces the maximum planning rounds", async () => {
    const plan = vi.fn(async () => planFor([candidates[0]]));
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { maxPlanningRounds: 1, maxUrlsPerRound: 1 },
      tracer: createTracer(),
      services: services({ plan }),
    });

    expect(plan).toHaveBeenCalledTimes(1);
    expect(result.planningRounds).toBe(1);
    expect(result.stopReason).toBe("planning_round_budget");
  });

  it("enforces the total evidence-character budget", async () => {
    const home = homepage("1234567890");
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: home,
      budget: { maxEvidenceChars: 15, maxUrlsPerRound: 1 },
      tracer: createTracer(),
      services: services({
        acquire: async (input) =>
          acquiredPage(input.url, input.category, "1234567890"),
      }),
    });

    expect(result.pages.reduce((total, page) => total + page.chars, 0)).toBe(15);
    expect(result.stopReason).toBe("character_budget");
  });

  it("stops gracefully when the gather deadline is exhausted", async () => {
    const ticks = [0, 0, 20];
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { gatherTimeoutMs: 10 },
      tracer: createTracer(),
      services: services({ now: () => ticks.shift() ?? 20 }),
    });

    expect(result.pages).toHaveLength(1);
    expect(result.stopReason).toBe("gather_timeout");
  });

  it("never inspects the same URL twice", async () => {
    const acquire = vi.fn(async (input) =>
      acquiredPage(input.url, input.category)
    );
    let round = 0;
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { maxPlanningRounds: 2, maxUrlsPerRound: 1 },
      tracer: createTracer(),
      services: services({
        plan: async () => {
          round++;
          return planFor([candidates[0]]);
        },
        acquire,
      }),
    });

    expect(round).toBe(2);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(result.pages.filter((page) => page.url === candidates[0].url)).toHaveLength(1);
  });

  it("keeps homepage evidence when an additional page fails", async () => {
    const tracer = createTracer();
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { maxPagesTotal: 2 },
      tracer,
      services: services({
        acquire: async (input) =>
          createEvidencePage({
            url: input.url,
            role: "supporting",
            category: input.category,
            status: "failed",
            error: "unavailable",
          }),
      }),
    });

    expect(result.pages.map((page) => page.status)).toEqual(["acquired", "failed"]);
    expect(combineEvidenceForGrading(result.pages)).toContain("Example homepage");
    expect(tracer.events.some((event) => event.type === "evidence.acquired")).toBe(false);
  });

  it("continues homepage-only when discovery fails", async () => {
    const tracer = createTracer();
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      tracer,
      services: services({
        discover: async () => {
          throw new Error("map unavailable");
        },
      }),
    });

    expect(result.pages).toHaveLength(1);
    expect(result.stopReason).toBe("discovery_failed");
    expect(tracer.events).toEqual([]);
  });

  it("continues homepage-only when no useful candidate exists", async () => {
    const tracer = createTracer();
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      tracer,
      services: services({
        discover: async () => [
          {
            url: "https://example.com/legal",
            path: "/legal",
            ranking: { priority: 0 },
          },
        ],
      }),
    });

    expect(result.pages).toHaveLength(1);
    expect(result.stopReason).toBe("no_candidates");
    expect(tracer.events.map((event) => event.type)).toEqual([
      "site.pages_discovered",
    ]);
  });

  it("emits only events for actions that occur and never exposes planner reasoning", async () => {
    const tracer = createTracer();
    await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { maxPagesTotal: 2 },
      tracer,
      services: services({
        plan: async () => ({
          ...planFor([candidates[0]]),
          reasoning: "SECRET_CHAIN_OF_THOUGHT",
        } as EvidencePlan),
      }),
    });

    expect(tracer.events.map((event) => event.type)).toEqual([
      "site.pages_discovered",
      "evidence.insufficient",
      "evidence.selected",
      "evidence.acquired",
    ]);
    expect(JSON.stringify(tracer.events)).not.toContain("SECRET_CHAIN_OF_THOUGHT");
  });

  it("skips discovery when maxPagesTotal is reduced to one", async () => {
    const discover = vi.fn(async () => candidates);
    const result = await gatherAuditEvidence({
      rootUrl: "https://example.com",
      identity,
      homepage: homepage(),
      budget: { maxPagesTotal: 1 },
      tracer: createTracer(),
      services: services({ discover }),
    });

    expect(discover).not.toHaveBeenCalled();
    expect(result.pages).toHaveLength(1);
    expect(result.stopReason).toBe("page_budget");
  });
});

describe("combineEvidenceForGrading", () => {
  it("puts homepage first, orders supporting pages deterministically, and adds source delimiters", () => {
    const combined = combineEvidenceForGrading([
      acquiredPage("https://example.com/security", "trust", "security proof"),
      homepage("homepage proof"),
      acquiredPage("https://example.com/pricing", "conversion", "pricing proof"),
    ]);

    expect(combined.indexOf("https://example.com/")).toBeLessThan(
      combined.indexOf("https://example.com/pricing")
    );
    expect(combined.indexOf("https://example.com/security")).toBeLessThan(
      combined.indexOf("https://example.com/pricing")
    );
    expect(combined).toContain("--- UNTRUSTED WEBSITE EVIDENCE S1 ---");
    expect(combined).toContain("--- END UNTRUSTED WEBSITE EVIDENCE S3 ---");
  });

  it("never exceeds the evidence-character ceiling", () => {
    const combined = combineEvidenceForGrading(
      [homepage("x".repeat(100))],
      { maxEvidenceChars: 50 }
    );
    expect(combined).toHaveLength(50);
  });
});
