import { describe, expect, it } from "vitest";
import { PILLAR_WEIGHTS } from "@/lib/audit/score";
import { makeLoadedAuditContext } from "./__testutils__/auditContext";
import {
  applyPublicAuditQaPolicy,
  answerDeterministically,
  classifyAuditFollowup,
  counterfactualScore,
  fallbackGroundedAnswer,
  matchingSources,
  scoreBreakdown,
} from "./auditQuestions";

describe("audit follow-up routing", () => {
  it("distinguishes audit follow-ups, general turns, and new URL audits", () => {
    expect(classifyAuditFollowup("Why did Conversion score 60?", true).type).toBe(
      "grounded_qa"
    );
    expect(classifyAuditFollowup("Why?", true).type).toBe("grounded_qa");
    expect(classifyAuditFollowup("What should we fix first?", true).type).toBe(
      "top_priority"
    );
    expect(
      classifyAuditFollowup("I disagree with the Messaging score.", true).type
    ).toBe("grounded_qa");
    expect(classifyAuditFollowup("tell me a joke", true).type).toBe("general");
    expect(classifyAuditFollowup("audit https://linear.app", true).type).toBe(
      "general"
    );
    expect(classifyAuditFollowup("Why did it score 69?", false).type).toBe(
      "missing_context"
    );
  });

  it("recognizes bounded future actions without starting research", () => {
    expect(
      classifyAuditFollowup("Can you inspect their security page too?", true)
        .type
    ).toBe("research_extension");
    expect(
      classifyAuditFollowup("compare this with the previous audit", true).type
    ).toBe("comparison_required");
  });
});

describe("deterministic audit answers", () => {
  it("answers inspected and uninspected source questions from actual sources", () => {
    const loaded = makeLoadedAuditContext();
    const pricingRoute = classifyAuditFollowup(
      "Did you inspect their pricing page?",
      true
    );
    const customersRoute = classifyAuditFollowup(
      "Did you inspect their customer stories?",
      true
    );
    const pricing = answerDeterministically(pricingRoute, loaded, "pricing");
    const customers = answerDeterministically(customersRoute, loaded, "customers");

    expect(pricing?.answer).toContain("/pricing [S2]");
    expect(pricing?.citations).toEqual(["S2"]);
    expect(customers?.answer).toContain("does not show");
    expect(customers?.answer).not.toContain("[S");
  });

  it("does not treat a broad trust category as proof of a security page", () => {
    const loaded = makeLoadedAuditContext();
    loaded.context.sources.push({
      ...loaded.context.sources[1],
      sourceId: "S3",
      url: "https://example.com/customers",
      path: "/customers",
      category: "trust",
    });

    expect(matchingSources(loaded.context.sources, "security")).toEqual([]);
    expect(matchingSources(loaded.context.sources, "customers")).toMatchObject([
      { sourceId: "S3", path: "/customers" },
    ]);
  });

  it("uses canonical weights for the exact deterministic breakdown", () => {
    const loaded = makeLoadedAuditContext();
    const breakdown = scoreBreakdown(loaded.context);
    const answer = answerDeterministically(
      { type: "score_breakdown" },
      loaded,
      "How did you get 69?"
    );

    expect(breakdown.total).toBe(loaded.context.outcome.overallScore);
    expect(breakdown.lines.map((line) => line.weight)).toEqual(
      Object.values(PILLAR_WEIGHTS)
    );
    expect(answer?.answer).not.toContain("Positioning: 80");
    expect(answer?.answer).toContain(
      "doesn't expose the individual dimension scores"
    );
    expect(answer?.answer).toContain("69/100");
  });

  it("answers explicit pillar-score questions without disclosing the score", () => {
    const loaded = makeLoadedAuditContext();
    const route = classifyAuditFollowup(
      "What score did Conversion get?",
      true
    );
    const answer = answerDeterministically(route, loaded, "What score did Conversion get?");

    expect(route).toEqual({ type: "pillar_score", pillar: "conversion" });
    expect(answer?.answer).toContain(
      "Verdict doesn't expose individual dimension scores"
    );
    expect(answer?.answer).toContain("conversion reason grounded in the audit");
    expect(answer?.answer).not.toContain("60");
  });

  it("explains strongest and weakest dimensions qualitatively in fallback", () => {
    const loaded = makeLoadedAuditContext();
    const strongest = fallbackGroundedAnswer(
      loaded,
      "Why was Positioning the strongest area?"
    );
    const weakest = fallbackGroundedAnswer(
      loaded,
      "Why was Conversion the weakest area?"
    );

    expect(strongest.answer).toContain("Positioning was the strongest area");
    expect(strongest.answer).toContain("positioning reason grounded in the audit");
    expect(strongest.answer).not.toContain("80");
    expect(weakest.answer).toContain("Conversion was one of the weakest areas");
    expect(weakest.answer).toContain("conversion weakness");
    expect(weakest.answer).not.toContain("60");
  });

  it("returns the public overall Growth Readiness Score", () => {
    const loaded = makeLoadedAuditContext();
    const route = classifyAuditFollowup(
      "What was our Growth Readiness Score?",
      true
    );
    const answer = answerDeterministically(
      route,
      loaded,
      "What was our Growth Readiness Score?"
    );

    expect(route.type).toBe("overall_score");
    expect(answer?.answer).toContain("69/100");
  });

  it("enforces the same qualitative score policy on model output", () => {
    const loaded = makeLoadedAuditContext();
    const answer = applyPublicAuditQaPolicy(
      {
        answer:
          "Positioning scored highest (80), while Conversion scored lowest (60). [S2] The pricing path creates friction.",
        citations: ["S2"],
        answerType: "score_explanation",
        confidence: "high",
        limitations: [],
      },
      loaded,
      "Why was Conversion the weakest area?"
    );

    expect(answer.answer).toContain("Positioning was the strongest area");
    expect(answer.answer).toContain("Conversion was one of the weakest areas");
    expect(answer.answer).toContain("pricing path creates friction");
    expect(answer.answer).not.toMatch(/\b(?:80|60)\b|\[S2\]/);
    expect(answer.citations).toEqual(["S2"]);
  });

  it("adds a concise homepage-only limitation from canonical source data", () => {
    const loaded = makeLoadedAuditContext();
    loaded.context.sources = [loaded.context.sources[0]];
    loaded.context.investigation.pagesInspected = 1;
    loaded.context.investigation.pagesAccepted = 1;
    const answer = applyPublicAuditQaPolicy(
      {
        answer: "Conversion was constrained by a generic call to action. [S1]",
        citations: ["S1"],
        answerType: "score_explanation",
        confidence: "medium",
        limitations: [
          "Conversion score is a framework-weighted calculation from the audit data, not a direct measurement.",
        ],
      },
      loaded,
      "Why was Conversion the weakest area?"
    );

    expect(answer.limitations).toEqual([
      "Based on the homepage inspected for this audit; additional conversion signals may exist elsewhere on the site.",
    ]);
  });

  it("does not add a homepage-only limitation to a multi-source audit", () => {
    const loaded = makeLoadedAuditContext();
    const answer = applyPublicAuditQaPolicy(
      {
        answer: "The homepage and pricing page support the conclusion.",
        citations: ["S1", "S2"],
        answerType: "evidence",
        confidence: "high",
        limitations: [],
      },
      loaded,
      "What evidence supports Conversion?"
    );

    expect(answer.limitations).toEqual([]);
  });

  it("calculates counterfactuals without mutating stored pillar scores", () => {
    const loaded = makeLoadedAuditContext();
    const before = structuredClone(loaded.context.pillars);
    const result = counterfactualScore(loaded.context, { conversion: 90 });

    expect(result.actual).toBe(69);
    expect(result.counterfactual).toBe(73);
    expect(loaded.context.pillars).toEqual(before);
    expect(() =>
      counterfactualScore(loaded.context, { conversion: 101 })
    ).toThrow("between 0 and 100");
  });

  it.each([
    ["sufficient", "coverage threshold"],
    ["page_budget", "maximum 5-page"],
    ["character_budget", "80,000-character"],
  ] as const)("explains %s without calling the audit exhaustive", (stopReason, phrase) => {
    const loaded = makeLoadedAuditContext();
    loaded.context.investigation.stopReason = stopReason;
    const answer = answerDeterministically(
      { type: "completeness" },
      loaded,
      "Was this exhaustive?"
    );

    expect(answer?.answer).toContain(phrase);
    expect(answer?.answer.toLowerCase()).toContain("not an exhaustive");
  });

  it("declines exact legacy source-detail claims", () => {
    const loaded = makeLoadedAuditContext();
    loaded.provenance = "legacy_fallback";
    loaded.sourceSemanticsAvailable = false;
    loaded.context.sources.forEach((source) => {
      source.keyFindings = [];
    });
    const answer = answerDeterministically(
      { type: "grounded_qa" },
      loaded,
      "What exactly did the pricing page say?"
    );

    expect(answer?.confidence).toBe("low");
    expect(answer?.answer).toContain("does not retain enough");
  });
});
