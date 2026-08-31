import { describe, expect, it } from "vitest";
import type { RunVerdictAuditResult } from "./runVerdictAudit";
import { summarizeVerdictAuditResult } from "./publicResult";

describe("public audit result contract", () => {
  it("projects only verified public fields and strips internal numeric pillar scores & telemetry", () => {
    const result = {
      reportId: "report-1",
      overallScore: 71,
      identity: {
        company_name: "Example",
        inferred_description: "Example product",
        target_audience: "Teams",
        primary_cta: "Start",
      },
      evidence: [
        {
          url: "https://example.com/",
          path: "/",
          role: "homepage",
          category: "identity",
          acquisitionMethod: "firecrawl",
          chars: 5000,
          status: "acquired",
          summary: "Homepage summary",
          signals: {
            wordCount: 500,
            headingCount: 8,
            hasPricingLanguage: false,
            hasCallToAction: true,
            hasTrustSignals: true,
            hasCompetitiveLanguage: false,
            hasGrowthContent: false,
          },
        },
      ],
      evidenceCoverage: {
        pagesTotal: 2,
        pagesAcquired: 2,
        pagesAccepted: 2,
        pagesRejected: 0,
        pagesFailed: 0,
        charsTotal: 10000,
        acceptedCharsTotal: 10000,
        categories: { identity: 1, conversion: 1 },
      },
      finalCoverage: {
        identity: "medium",
        positioning: "medium",
        messaging: "medium",
        conversion: "low",
        trust: "low",
        market: "low",
        growth: "low",
      },
      pagesInspected: 2,
      pagesAccepted: 2,
      budgetUsage: {
        pagesInspected: 2,
        pagesUsed: 2,
        maxPages: 5,
        evidenceChars: 10000,
        maxEvidenceChars: 80_000,
        planningRounds: 1,
        maxPlanningRounds: 3,
        gatherTimeoutMs: 40_000,
      },
      stopReason: "sufficient",
      investigation: {
        candidatesDiscovered: 5,
        candidatesRetained: 2,
        planningRounds: 1,
        pageAttempts: 2,
        stopReason: "sufficient",
      },
      audit: {
        company_name: "Example",
        score_interpretation: "Solid growth foundation with room for conversion improvement.",
        the_verdict: {
          status: "Promising",
          primary_constraint: "Pricing is not visible upfront.",
          highest_opportunity: "Add clear self-serve tiers.",
          estimated_impact: "High",
        },
        priority_matrix: [
          {
            task: "Add visible pricing link",
            why: "Reduces buyer friction",
            impact: "High",
            effort: "Low",
          },
        ],
        pillars: {
          positioning: {
            score: 75,
            confidence: "High",
            reason: "Clear target audience and positioning.",
            strengths: ["Strong ICP definition"],
            weaknesses: ["Competitor differentiation needs sharpening"],
          },
          conversion: {
            score: 60,
            confidence: "Medium",
            reason: "Missing direct pricing CTA.",
            strengths: ["Clear primary CTA button"],
            weaknesses: ["No pricing page link"],
          },
        },
      },
      trace: [],
      evidenceTrace: {} as RunVerdictAuditResult["evidenceTrace"],
      auditContext: {
        sources: [
          {
            sourceId: "S1",
            url: "https://example.com/",
            path: "/",
            role: "homepage",
            category: "identity",
            acquisitionMethod: "firecrawl",
            chars: 5000,
            keyFindings: ["Clean hero section with signup button"],
            relevantSignals: ["hasCallToAction"],
          },
          {
            sourceId: "S2",
            url: "https://example.com/pricing",
            path: "/pricing",
            role: "supporting",
            category: "conversion",
            acquisitionMethod: "firecrawl",
            chars: 5000,
            keyFindings: ["Pricing tier details"],
            relevantSignals: ["hasPricingLanguage"],
          },
        ],
      } as unknown as RunVerdictAuditResult["auditContext"],
      modelProvenance: { planner: [] },
    } as RunVerdictAuditResult;

    const summary = summarizeVerdictAuditResult(result);

    // 1. Overall Growth Readiness Score remains public
    expect(summary.overallScore).toBe(71);

    // 2. No public numeric pillar score — qualitative fields preserved
    expect(summary.pillars.positioning).toEqual({
      confidence: "High",
      reason: "Clear target audience and positioning.",
      strengths: ["Strong ICP definition"],
      weaknesses: ["Competitor differentiation needs sharpening"],
    });
    expect(summary.pillars.positioning).not.toHaveProperty("score");
    expect(summary.pillars.conversion).not.toHaveProperty("score");

    // 3. Internal numeric pillar score remains intact on original object
    expect((result.audit.pillars as any).positioning.score).toBe(75);
    expect((result.audit.pillars as any).conversion.score).toBe(60);

    // 4. Stable source grounding is provided without leaking internal fields
    expect(summary.sources).toEqual([
      {
        url: "https://example.com/",
        path: "/",
        role: "homepage",
        category: "identity",
        keyFindings: ["Clean hero section with signup button"],
      },
      {
        url: "https://example.com/pricing",
        path: "/pricing",
        role: "supporting",
        category: "conversion",
        keyFindings: ["Pricing tier details"],
      },
    ]);
    expect(summary.sources[0]).not.toHaveProperty("sourceId");
    expect(summary.sources[0]).not.toHaveProperty("acquisitionMethod");
    expect(summary.sources[0]).not.toHaveProperty("chars");
    expect(summary.sources[0]).not.toHaveProperty("graderChars");
    expect(summary.sources[0]).not.toHaveProperty("relevantSignals");

    // 5. Verified public contract fields match exact set of expected keys
    expect(Object.keys(summary).sort()).toEqual([
      "company_name",
      "evidenceCoverage",
      "identity",
      "overallScore",
      "pagesAccepted",
      "pagesInspected",
      "pillars",
      "priority_matrix",
      "reportId",
      "score_interpretation",
      "sources",
      "stopReason",
      "the_verdict",
    ].sort());

    // 6. Internal crawler/budget/planner telemetry is completely absent
    expect(summary).not.toHaveProperty("evidence");
    expect(summary).not.toHaveProperty("finalCoverage");
    expect(summary).not.toHaveProperty("budgetUsage");
    expect(summary).not.toHaveProperty("investigation");
    expect(summary).not.toHaveProperty("trace");
    expect(summary).not.toHaveProperty("evidenceTrace");
    expect(summary).not.toHaveProperty("auditContext");
  });

  it("falls back to acquired evidence pages if auditContext is absent", () => {
    const result = {
      reportId: "report-2",
      overallScore: 80,
      identity: {
        company_name: "FallbackCo",
        inferred_description: "Desc",
        target_audience: "Audience",
        primary_cta: "CTA",
      },
      evidence: [
        {
          url: "https://fallback.com/",
          path: "/",
          role: "homepage",
          category: "identity",
          acquisitionMethod: "native",
          chars: 2000,
          status: "acquired",
        },
        {
          url: "https://fallback.com/failed",
          path: "/failed",
          role: "supporting",
          category: "trust",
          acquisitionMethod: "native",
          chars: 0,
          status: "failed",
        },
      ],
      evidenceCoverage: {
        pagesTotal: 1,
        pagesAcquired: 1,
        pagesAccepted: 1,
        pagesRejected: 0,
        pagesFailed: 1,
        charsTotal: 2000,
        acceptedCharsTotal: 2000,
        categories: { identity: 1 },
      },
      pagesInspected: 1,
      pagesAccepted: 1,
      stopReason: "no_candidates",
      audit: {
        company_name: "FallbackCo",
        score_interpretation: "Good",
        the_verdict: {
          status: "Pass",
          primary_constraint: "None",
          highest_opportunity: "Scale",
          estimated_impact: "High",
        },
        priority_matrix: [],
        pillars: {},
      },
    } as unknown as RunVerdictAuditResult;

    const summary = summarizeVerdictAuditResult(result);
    expect(summary.sources).toEqual([
      {
        url: "https://fallback.com/",
        path: "/",
        role: "homepage",
        category: "identity",
      },
    ]);
  });
});
