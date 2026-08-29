import { describe, expect, it } from "vitest";
import type { EvidenceCandidate } from "./discover";
import type { EvidenceCoverageAssessment } from "./evidence";
import { createEvidencePage } from "./evidence";
import { planEvidence, type PlanEvidenceInput } from "./plan";

const coverage: EvidenceCoverageAssessment = {
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
    ranking: { priority: 100, matchedKeyword: "pricing" },
  },
  {
    url: "https://example.com/security",
    path: "/security",
    category: "trust",
    ranking: { priority: 90, matchedKeyword: "security" },
  },
];

function plannerInput(): PlanEvidenceInput {
  return {
    identity: {
      company_name: "Example",
      inferred_description: "Example product",
      target_audience: "Teams",
      primary_cta: "Start",
    },
    pages: [
      createEvidencePage({
        url: "https://example.com",
        role: "homepage",
        category: "identity",
        acquisitionMethod: "firecrawl",
        markdown: "Example homepage",
        status: "acquired",
      }),
    ],
    currentCoverage: coverage,
    candidates,
    budget: {
      pagesRemaining: 4,
      planningRoundsRemaining: 2,
      maxUrlsThisRound: 2,
      evidenceCharsRemaining: 70_000,
      gatherTimeRemainingMs: 20_000,
    },
  };
}

function modelResponse(selections: unknown[]): string {
  return JSON.stringify({
    done: false,
    coverage,
    missing: ["conversion", "trust", "market", "growth"],
    selections,
  });
}

describe("planEvidence", () => {
  it("accepts selections only from discovered candidates", async () => {
    const plan = await planEvidence(plannerInput(), {
      generate: async () =>
        modelResponse([
          {
            url: "https://example.com/security",
            category: "trust",
            reasonCode: "trust_evidence_needed",
          },
        ]),
    });

    expect(plan.source).toBe("model");
    expect(plan.selections).toEqual([
      {
        url: "https://example.com/security",
        category: "trust",
        reasonCode: "trust_evidence_needed",
      },
    ]);
  });

  it("rejects an invented planner URL and uses the safe fallback", async () => {
    const plan = await planEvidence(plannerInput(), {
      generate: async () =>
        modelResponse([
          {
            url: "https://attacker.test/admin",
            category: "trust",
            reasonCode: "trust_evidence_needed",
          },
          {
            url: "https://example.com/pricing",
            category: "conversion",
            reasonCode: "conversion_evidence_needed",
          },
        ]),
    });

    expect(plan.source).toBe("fallback");
    expect(plan.fallbackReason).toBe("invalid_selection");
    expect(plan.selections.every((selection) =>
      candidates.some((candidate) => candidate.url === selection.url)
    )).toBe(true);
  });

  it("falls back when every model selection is invalid", async () => {
    const plan = await planEvidence(plannerInput(), {
      generate: async () =>
        modelResponse([
          {
            url: "https://attacker.test/admin",
            category: "trust",
            reasonCode: "trust_evidence_needed",
          },
        ]),
    });

    expect(plan.source).toBe("fallback");
    expect(plan.fallbackReason).toBe("invalid_selection");
    expect(plan.selections.every((selection) =>
      candidates.some((candidate) => candidate.url === selection.url)
    )).toBe(true);
  });

  it("falls back deterministically for malformed JSON", async () => {
    const plan = await planEvidence(plannerInput(), {
      generate: async () => "not-json",
    });

    expect(plan.source).toBe("fallback");
    expect(plan.fallbackReason).toBe("malformed");
    expect(plan.selections[0].url).toBe("https://example.com/pricing");
  });

  it("falls back when the planner times out", async () => {
    const plan = await planEvidence(plannerInput(), {
      timeoutMs: 5,
      generate: () => new Promise(() => {}),
    });

    expect(plan.source).toBe("fallback");
    expect(plan.fallbackReason).toBe("timeout");
    expect(plan.selections.length).toBeGreaterThan(0);
  });

  it("sends compact evidence metadata rather than full page markdown", async () => {
    const input = plannerInput();
    input.pages = [
      createEvidencePage({
        url: "https://example.com",
        role: "homepage",
        category: "identity",
        acquisitionMethod: "firecrawl",
        markdown: `${"a".repeat(300)}FULL_MARKDOWN_SENTINEL`,
        status: "acquired",
      }),
    ];
    let capturedPrompt = "";

    await planEvidence(input, {
      generate: async (prompt) => {
        capturedPrompt = prompt;
        return modelResponse([
          {
            url: "https://example.com/pricing",
            category: "conversion",
            reasonCode: "conversion_evidence_needed",
          },
        ]);
      },
    });

    expect(capturedPrompt).not.toContain("FULL_MARKDOWN_SENTINEL");
    expect(capturedPrompt).toContain(`"summary":"${"a".repeat(240)}"`);
  });
});
