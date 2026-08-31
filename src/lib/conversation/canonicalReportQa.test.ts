import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deriveCanonicalReportFacts,
  projectCanonicalReportFacts,
} from "@/lib/audit/canonicalReport";
import {
  classifyAuditFollowup,
  answerDeterministically,
  applyPublicAuditQaPolicy,
  fallbackGroundedAnswer,
} from "./auditQuestions";
import {
  buildAuditQaPrompt,
  sanitizeAuditQaResponse,
} from "./auditQa";
import { GROWTH_READINESS_FRAMEWORK } from "@/lib/audit/score";
import type { LoadedAuditContext } from "./auditContextLoader";
import type { AuditContextPackV1 } from "@/lib/audit/auditContext";

// Linear Real Audit Fixture from Observed Incident
const LINEAR_AUDIT_CONTEXT: AuditContextPackV1 = {
  version: 1,
  reportId: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  audited: {
    url: "https://linear.app",
    domain: "linear.app",
    timestamp: "2026-08-31T20:00:00.000Z",
  },
  companyIdentity: {
    company_name: "Linear",
    inferred_description: "Issue tracking and project management tool built for high-performance software teams.",
    target_audience: "Software engineering teams and product leaders",
    primary_cta: "Sign up for free",
  },
  outcome: {
    overallScore: 82,
    scoreInterpretation: "Linear shows world-class positioning and copy clarity with high brand authority.",
    finalVerdict: {
      status: "Ready for Scaled Inbound",
      primary_constraint: "Growth foundation requires structured enterprise expansion and self-serve onboarding depth.",
      highest_opportunity: "Expand enterprise procurement signals and team-level self-serve activation loops.",
      estimated_impact: "+18-24% expansion revenue velocity",
    },
  },
  pillars: {
    positioning: {
      score: 92,
      confidence: "high",
      reason: "Positioning is laser-focused on high-velocity engineering teams with clear ICP differentiation.",
      strengths: ["Uncompromising speed and opinionated workflow positioning", "Clear developer-first ethos"],
      weaknesses: ["Enterprise procurement positioning could be more prominent"],
    },
    messaging: {
      score: 88,
      confidence: "high",
      reason: "Copy is exceptionally concise, resonant, and free of enterprise fluff.",
      strengths: ["Clear benefit-driven headlines", "Strong microcopy across interactive components"],
      weaknesses: ["Secondary tier messaging is less defined"],
    },
    website_ux: {
      score: 85,
      confidence: "high",
      reason: "Sleek keyboard-first design with fluid interactions and dark aesthetic.",
      strengths: ["Sub-50ms perceived interaction latency", "Impeccable visual craft"],
      weaknesses: ["Mobile viewport navigation requires extra taps"],
    },
    conversion: {
      score: 78,
      confidence: "medium",
      reason: "Frictionless authentication flow but gated enterprise contact path.",
      strengths: ["Single-click OAuth signup"],
      weaknesses: ["Enterprise sales handoff form has friction"],
    },
    trust: {
      score: 80,
      confidence: "high",
      reason: "Strong peer testimonials from top engineering startups.",
      strengths: ["Logo wall of iconic tech companies", "Customer quotes from known CTOs"],
      weaknesses: ["Compliance and SOC2 badges tucked away in footer"],
    },
    competition: {
      score: 82,
      confidence: "medium",
      reason: "Clear defensibility around workflow speed and keyboard shortcuts.",
      strengths: ["Loyal power-user developer moat"],
      weaknesses: ["Incumbents expanding into lightweight issue tracking"],
    },
    growth_foundation: {
      score: 65,
      confidence: "medium",
      reason: "Growth loops rely heavily on viral word-of-mouth with limited structured referral incentives.",
      strengths: ["Organic bottom-up adoption by developers"],
      weaknesses: ["Limited built-in referral mechanisms", "Self-serve onboarding depth is light"],
    },
  },
  priorityMatrix: [
    {
      task: "Implement guided self-serve team activation checklists",
      impact: "High",
      effort: "Low",
      why: "Accelerates day-1 team invite velocity across newly created workspaces.",
    },
    {
      task: "Surface enterprise compliance and security artifacts upfront",
      impact: "High",
      effort: "Medium",
      why: "Reduces procurement cycle friction for enterprise prospects.",
    },
  ],
  investigation: {
    pagesInspected: 4,
    pagesAccepted: 4,
    finalCoverage: {
      identity: "high",
      positioning: "high",
      messaging: "high",
      conversion: "high",
      trust: "medium",
      market: "medium",
      growth: "low",
    },
    planningRounds: 2,
    stopReason: "sufficient",
    budgetUsage: {
      pagesInspected: 4,
      pagesAccepted: 4,
      pagesUsed: 4,
      maxPages: 5,
      evidenceChars: 32000,
      maxEvidenceChars: 80000,
      planningRounds: 2,
      maxPlanningRounds: 3,
      gatherTimeoutMs: 40000,
    },
  },
  sources: [
    {
      sourceId: "S1",
      url: "https://linear.app",
      path: "/",
      role: "homepage",
      category: "identity",
      acquisitionMethod: "native",
      chars: 8500,
      keyFindings: ["Linear positions itself as the issue tracker built for high-performance teams"],
      relevantSignals: ["pricing_language_present", "call_to_action_present"],
    },
    {
      sourceId: "S2",
      url: "https://linear.app/pricing",
      path: "/pricing",
      role: "supporting",
      category: "conversion",
      acquisitionMethod: "native",
      chars: 7200,
      keyFindings: ["Free tier with paid tiers scaling per active user"],
      relevantSignals: ["pricing_language_present"],
    },
    {
      sourceId: "S3",
      url: "https://linear.app/integrations",
      path: "/integrations",
      role: "supporting",
      category: "growth",
      acquisitionMethod: "native",
      chars: 6400,
      keyFindings: ["Integrations support organic adoption, while structured referral mechanics are not prominent"],
      relevantSignals: ["integration_ecosystem_present"],
    },
  ],
  framework: GROWTH_READINESS_FRAMEWORK,
  engineVersion: "1.0.0",
};

const LOADED_LINEAR_CONTEXT: LoadedAuditContext = {
  reportId: LINEAR_AUDIT_CONTEXT.reportId!,
  context: LINEAR_AUDIT_CONTEXT,
  provenance: "audit_context",
  sourceSemanticsAvailable: true,
};

describe("Canonical Report Truth & Grounded Q&A Invariants", () => {
  it("Invariant 1: deriveCanonicalReportFacts deterministically derives strongest and weakest pillars matching AuditResultCard", () => {
    const facts = deriveCanonicalReportFacts(LINEAR_AUDIT_CONTEXT);

    expect(facts.companyName).toBe("Linear");
    expect(facts.overallScore).toBe(82);
    expect(facts.strongestDimension.key).toBe("positioning");
    expect(facts.strongestDimension.label).toBe("Positioning");
    expect(facts.strongestDimension.score).toBe(92);

    expect(facts.weakestDimension.key).toBe("growth_foundation");
    expect(facts.weakestDimension.label).toBe("Growth Foundation");
    expect(facts.weakestDimension.score).toBe(65);

    expect(facts.dimensions.positioning.standing).toBe("strongest");
    expect(facts.dimensions.growth_foundation.standing).toBe("weakest");
    expect(facts.dimensions.website_ux.standing).toBe("between_strongest_and_weakest");
  });

  it("Invariant 2: Deterministically answers 'What is the strongest pillar?' with canonical strongest dimension (Positioning)", () => {
    const route = classifyAuditFollowup("What is the strongest pillar for this company during the evaluation?", true);
    expect(route.type).toBe("strongest_dimension");

    const answer = answerDeterministically(route, LOADED_LINEAR_CONTEXT, "What is the strongest pillar?");
    expect(answer).not.toBeNull();
    expect(answer?.answer).toContain("Positioning");
    expect(answer?.answer).toContain("was the strongest area in this audit");
    expect(answer?.answer).not.toContain("Website UX");
    expect(answer?.answer).not.toContain("Conversion");
  });

  it("Invariant 3: Deterministically answers 'What is the weakest pillar?' with canonical weakest dimension (Growth Foundation)", () => {
    const route = classifyAuditFollowup("What was the weakest pillar for this company?", true);
    expect(route.type).toBe("weakest_dimension");

    const answer = answerDeterministically(route, LOADED_LINEAR_CONTEXT, "What was the weakest pillar?");
    expect(answer).not.toBeNull();
    expect(answer?.answer).toContain("Growth Foundation");
    expect(answer?.answer).toContain("was the weakest area in this audit");
    expect(answer?.answer).not.toContain("Conversion");
  });

  it("Invariant 4: Deterministically answers 'What is the primary bottleneck?' with canonical primary constraint", () => {
    const route = classifyAuditFollowup("What is the primary bottleneck for this startup?", true);
    expect(route.type).toBe("primary_bottleneck");

    const answer = answerDeterministically(route, LOADED_LINEAR_CONTEXT, "What is the primary bottleneck?");
    expect(answer).not.toBeNull();
    expect(answer?.answer).toContain("Growth foundation requires structured enterprise expansion");
  });

  it("Invariant 5: Answers 'What should I fix first?' anchored in canonical top priority", () => {
    const route = classifyAuditFollowup("What should I fix first to improve growth?", true);
    expect(route.type).toBe("top_priority");

    const answer = answerDeterministically(route, LOADED_LINEAR_CONTEXT, "What should I fix first?");
    expect(answer).not.toBeNull();
    expect(answer?.answer).toContain("Implement guided self-serve team activation checklists");
  });

  it("deterministically returns the canonical highest-leverage opportunity", () => {
    const route = classifyAuditFollowup(
      "What is the highest-leverage opportunity?",
      true
    );
    const answer = answerDeterministically(
      route,
      LOADED_LINEAR_CONTEXT,
      "What is the highest-leverage opportunity?"
    );

    expect(route.type).toBe("highest_opportunity");
    expect(answer?.answer).toContain(
      "Expand enterprise procurement signals and team-level self-serve activation loops"
    );
  });

  it("Invariant 6: Deterministically answers 'What was the score?' with overall Growth Readiness Score", () => {
    const route = classifyAuditFollowup("What was our overall Growth Readiness Score?", true);
    expect(route.type).toBe("overall_score");

    const answer = answerDeterministically(route, LOADED_LINEAR_CONTEXT, "What was our overall Growth Readiness Score?");
    expect(answer).not.toBeNull();
    expect(answer?.answer).toContain("**82/100**");
  });

  it("Invariant 7: Protects individual pillar numeric scores while explaining qualitative standing", () => {
    const route = classifyAuditFollowup("What score did Positioning get?", true);
    expect(route.type).toBe("pillar_score");

    const answer = answerDeterministically(route, LOADED_LINEAR_CONTEXT, "What score did Positioning get?");
    expect(answer).not.toBeNull();
    expect(answer?.answer).toContain("Verdict doesn't expose individual dimension scores");
    expect(answer?.answer).toContain("Positioning was the strongest area");
    expect(answer?.answer).not.toContain("92/100");
  });

  it("Invariant 8: Grounded Q&A prompt embeds canonical report conclusions as immutable facts at the top", () => {
    const prompt = buildAuditQaPrompt({
      question: "Why is the Growth Foundation weakest? Isn't it scalable enough?",
      loaded: LOADED_LINEAR_CONTEXT,
    });

    expect(prompt).toContain("canonicalReportConclusions");
    expect(prompt).toContain('"strongestDimension":"Positioning"');
    expect(prompt).toContain('"weakestDimension":"Growth Foundation"');
    expect(prompt).toContain('"overallScore":82');
    expect(prompt).toContain("BEGIN UNTRUSTED REPORT SUPPORT DATA");
    expect(prompt).toContain("END UNTRUSTED REPORT SUPPORT DATA");
  });

  it("Invariant 9: applyPublicAuditQaPolicy sanitizes internal terminology ('typed audit data', 'relativeStanding', etc.)", () => {
    const mockModelAnswer = {
      answer: "According to the typed audit data, Positioning was rated highest. The relativeStanding indicates it was between_strongest_and_weakest in other contexts [S1].",
      citations: ["S1" as const],
      answerType: "score_explanation" as const,
      confidence: "high" as const,
      limitations: [],
    };

    const sanitized = applyPublicAuditQaPolicy(
      mockModelAnswer,
      LOADED_LINEAR_CONTEXT,
      "Why is Positioning strong?"
    );

    expect(sanitized.answer).not.toContain("typed audit data");
    expect(sanitized.answer).not.toContain("relativeStanding");
    expect(sanitized.answer).not.toContain("between_strongest_and_weakest");
    expect(sanitized.answer).not.toContain("[S1]");
    expect(sanitized.answer).toContain("this audit");
  });

  it("Invariant 10: Prevents cross-report bleeding when switching active reports (Morpho -> Linear -> Solana)", () => {
    const MORPHO_CONTEXT: AuditContextPackV1 = {
      ...LINEAR_AUDIT_CONTEXT,
      reportId: "morpho-111",
      companyIdentity: { ...LINEAR_AUDIT_CONTEXT.companyIdentity, company_name: "Morpho" },
      outcome: { ...LINEAR_AUDIT_CONTEXT.outcome, overallScore: 74 },
      pillars: {
        ...LINEAR_AUDIT_CONTEXT.pillars,
        trust: { ...LINEAR_AUDIT_CONTEXT.pillars.trust, score: 95 },
        positioning: { ...LINEAR_AUDIT_CONTEXT.pillars.positioning, score: 60 },
      },
    };

    const morphoFacts = deriveCanonicalReportFacts(MORPHO_CONTEXT);
    expect(morphoFacts.companyName).toBe("Morpho");
    expect(morphoFacts.strongestDimension.label).toBe("Trust");

    const linearFacts = deriveCanonicalReportFacts(LINEAR_AUDIT_CONTEXT);
    expect(linearFacts.companyName).toBe("Linear");
    expect(linearFacts.strongestDimension.label).toBe("Positioning");
  });

  it.each([
    ["Why is Growth Foundation the weakest?", "Growth Foundation was the weakest area"],
    ["Why is Positioning the strongest?", "Positioning was the strongest area"],
    ["Why is Conversion weaker than Positioning?", "Conversion ranked below Positioning"],
    ["Isn't Growth Foundation scalable enough?", "Growth Foundation was the weakest area"],
    ["What evidence supports Growth Foundation being weakest?", "Growth Foundation was the weakest area"],
  ])("deterministically anchors explanatory question: %s", (question, anchor) => {
    const answer = fallbackGroundedAnswer(LOADED_LINEAR_CONTEXT, question);

    expect(answer.answer).toContain(anchor);
    expect(answer.answer).not.toContain("Conversion was the weakest");
    expect(answer.answer).not.toContain("Website & UX was the strongest");
  });

  it("corrects a false weakest premise before explaining the canonical area", () => {
    const answer = fallbackGroundedAnswer(
      LOADED_LINEAR_CONTEXT,
      "Why is Conversion the weakest?"
    );

    expect(answer.answer).toContain(
      "Growth Foundation, rather than Conversion, was the weakest area in this audit"
    );
    expect(answer.answer).toContain(
      "Growth loops rely heavily on viral word-of-mouth"
    );
  });

  it("keeps accepted sources available without allowing them to choose the ranking", () => {
    const answer = fallbackGroundedAnswer(
      LOADED_LINEAR_CONTEXT,
      "What evidence supports Growth Foundation being weakest?"
    );

    expect(answer.citations).toEqual(["S3"]);
    expect(answer.answer).toContain("do not change the report's ranking");
  });

  it("round-trips fresh and restored workspace facts through the score-free projection", () => {
    const canonical = deriveCanonicalReportFacts(LINEAR_AUDIT_CONTEXT);
    const projection = projectCanonicalReportFacts(LINEAR_AUDIT_CONTEXT);
    const restored = deriveCanonicalReportFacts({
      overallScore: 82,
      identity: LINEAR_AUDIT_CONTEXT.companyIdentity,
      the_verdict: LINEAR_AUDIT_CONTEXT.outcome.finalVerdict,
      priority_matrix: LINEAR_AUDIT_CONTEXT.priorityMatrix,
      pillars: Object.fromEntries(
        Object.entries(LINEAR_AUDIT_CONTEXT.pillars).map(([key, pillar]) => [
          key,
          {
            confidence: pillar.confidence,
            reason: pillar.reason,
            strengths: pillar.strengths,
            weaknesses: pillar.weaknesses,
          },
        ])
      ),
      canonicalReportFacts: projection,
    });

    expect(restored.dimensionRankingAvailable).toBe(true);
    expect(restored.strongestDimension.key).toBe(
      canonical.strongestDimension.key
    );
    expect(restored.weakestDimension.key).toBe(canonical.weakestDimension.key);
    expect(restored.overallScore).toBe(canonical.overallScore);
    expect(restored.primaryBottleneck).toBe(canonical.primaryBottleneck);
    expect(restored.priorities[0]?.task).toBe(canonical.priorities[0]?.task);
  });
});
