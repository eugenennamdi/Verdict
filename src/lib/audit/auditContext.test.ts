import { describe, expect, it } from "vitest";
import {
  buildAuditContextPack,
  parseAuditContextPack,
  sanitizeEvidenceDigests,
  VERDICT_ENGINE_VERSION,
} from "./auditContext";
import { GROWTH_READINESS_FRAMEWORK, PILLAR_WEIGHTS } from "./score";
import type { EvidenceSourceReference } from "./source";

const coverage = {
  identity: "high",
  positioning: "medium",
  messaging: "medium",
  conversion: "high",
  trust: "low",
  market: "low",
  growth: "medium",
} as const;

const budgetUsage = {
  pagesInspected: 2,
  pagesUsed: 2,
  maxPages: 5,
  evidenceChars: 2048,
  maxEvidenceChars: 80_000,
  planningRounds: 1,
  maxPlanningRounds: 3,
  gatherTimeoutMs: 40_000,
};

const sources: EvidenceSourceReference[] = [
  {
    sourceId: "S1",
    url: "https://example.com/",
    path: "/",
    role: "homepage",
    category: "identity",
    acquisitionMethod: "firecrawl",
    chars: 1200,
    signals: {
      wordCount: 180,
      headingCount: 4,
      hasPricingLanguage: false,
      hasCallToAction: true,
      hasTrustSignals: false,
      hasCompetitiveLanguage: false,
      hasGrowthContent: false,
    },
  },
  {
    sourceId: "S2",
    url: "https://example.com/pricing",
    path: "/pricing",
    role: "supporting",
    category: "conversion",
    acquisitionMethod: "jina",
    chars: 848,
  },
];

function buildContext() {
  const pillar = {
    score: 70,
    confidence: "High",
    reason: "Clear evidence",
    strengths: ["Specific message"],
    weaknesses: ["Limited trust proof"],
  };
  return buildAuditContextPack({
    url: "https://example.com",
    auditTimestamp: "2026-08-30T10:00:00.000Z",
    identity: {
      company_name: "Example",
      inferred_description: "A focused product",
      target_audience: "Teams",
      primary_cta: "Start now",
    },
    audit: {
      score_interpretation: "Promising foundation",
      pillars: Object.fromEntries(
        Object.keys(PILLAR_WEIGHTS).map((key) => [key, pillar])
      ),
      the_verdict: {
        status: "Promising",
        primary_constraint: "Trust evidence",
        highest_opportunity: "Add customer proof",
        estimated_impact: "Medium",
      },
      priority_matrix: [
        {
          task: "Publish a case study",
          impact: "High",
          effort: "Medium",
          why: "Build trust",
        },
      ],
      markdown: "FULL_MARKDOWN_MUST_NOT_PERSIST",
      prompt: "SYSTEM_PROMPT_MUST_NOT_PERSIST",
      reasoning: "CHAIN_OF_THOUGHT_MUST_NOT_PERSIST",
      apiKey: "SECRET_VALUE_MUST_NOT_PERSIST",
      providerError: "provider unavailable raw body",
    },
    overallScore: 70,
    sources,
    evidenceDigests: [
      {
        sourceId: "S1",
        keyFindings: ["The homepage names teams as its audience."],
        relevantSignals: ["Clear primary CTA"],
      },
      {
        sourceId: "S9",
        keyFindings: ["Invented source"],
        relevantSignals: [],
      },
    ],
    finalCoverage: coverage,
    planningRounds: 1,
    stopReason: "no_selection",
    budgetUsage,
    models: {
      normalization: {
        requestedPrimaryModel: "gemini-3.7-flash",
        provider: "google",
        model: "gemini-3.7-flash",
        modelUsed: "gemini-3.7-flash",
        tier: "primary",
        fallbackUsed: false,
      },
      planner: [],
      grader: {
        requestedPrimaryModel: "gemini-3.7-flash",
        provider: "deepseek",
        model: "deepseek-v4-pro",
        modelUsed: "deepseek-v4-pro",
        tier: "secondary",
        fallbackUsed: true,
        availabilityErrorCategory: "unavailable",
      },
    },
  });
}

describe("AuditContextPackV1", () => {
  it("serializes the grounded audit, exact framework, and investigation metadata", () => {
    const context = buildContext();

    expect(context).toMatchObject({
      version: 1,
      audited: {
        url: "https://example.com/",
        domain: "example.com",
        timestamp: "2026-08-30T10:00:00.000Z",
      },
      outcome: { overallScore: 70 },
      investigation: {
        pagesInspected: 2,
        finalCoverage: coverage,
        planningRounds: 1,
        stopReason: "no_selection",
        budgetUsage,
      },
      framework: GROWTH_READINESS_FRAMEWORK,
      engineVersion: VERDICT_ENGINE_VERSION,
      models: {
        normalization: {
          requestedPrimaryModel: "gemini-3.7-flash",
          provider: "google",
          model: "gemini-3.7-flash",
          modelUsed: "gemini-3.7-flash",
          tier: "primary",
          fallbackUsed: false,
        },
        planner: [],
        grader: {
          requestedPrimaryModel: "gemini-3.7-flash",
          provider: "deepseek",
          model: "deepseek-v4-pro",
          modelUsed: "deepseek-v4-pro",
          tier: "secondary",
          fallbackUsed: true,
          availabilityErrorCategory: "unavailable",
        },
      },
    });
    expect(context.framework.pillars).toEqual(PILLAR_WEIGHTS);
    expect(context.sources.map((source) => source.sourceId)).toEqual([
      "S1",
      "S2",
    ]);
  });

  it("accepts known digests, rejects invented IDs, and falls back safely", () => {
    const digests = sanitizeEvidenceDigests(
      [
        {
          sourceId: "S1",
          keyFindings: ["Grounded finding"],
          relevantSignals: ["cta_present"],
        },
        {
          sourceId: "S404",
          keyFindings: ["Invented"],
          relevantSignals: [],
        },
      ],
      sources
    );

    expect(digests.map((digest) => digest.sourceId)).toEqual(["S1", "S2"]);
    expect(digests[0].keyFindings).toEqual(["Grounded finding"]);
    expect(digests[1].keyFindings).toEqual([]);
    expect(digests.some((digest) => digest.sourceId === "S404")).toBe(false);
    expect(() => sanitizeEvidenceDigests(undefined, sources)).not.toThrow();
  });

  it("never copies markdown, prompts, reasoning, or secret-shaped fields", () => {
    const serialized = JSON.stringify(buildContext());

    for (const forbidden of [
      "FULL_MARKDOWN_MUST_NOT_PERSIST",
      "SYSTEM_PROMPT_MUST_NOT_PERSIST",
      "CHAIN_OF_THOUGHT_MUST_NOT_PERSIST",
      "SECRET_VALUE_MUST_NOT_PERSIST",
      '"markdown"',
      '"prompt"',
      '"reasoning"',
      '"apiKey"',
      "provider unavailable raw body",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("supports old reports with null or absent audit_context", () => {
    expect(parseAuditContextPack(null)).toBeNull();
    expect(parseAuditContextPack(undefined)).toBeNull();
    expect(parseAuditContextPack({ version: 0 })).toBeNull();
    expect(parseAuditContextPack(buildContext())?.version).toBe(1);
  });
});
