import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { VERDICT_AUDIT_SCHEMA } from "@/lib/engine";
import { AUDIT_QA_SCHEMA } from "@/lib/conversation/auditQa";
import { computeOverallScore } from "./score";
import { parseAndValidateStructuredOutput } from "./structuredOutput";

const pillar = {
  score: 70,
  confidence: "High",
  reason: "Grounded reason",
  strengths: ["Clear"],
  weaknesses: ["Limited proof"],
};

function validAudit() {
  return {
    is_valid_startup: true,
    invalid_reason: "",
    company_name: "Example",
    score_interpretation: "Ready",
    pillars: {
      positioning: { ...pillar, score: 80 },
      messaging: { ...pillar, score: 75 },
      website_ux: { ...pillar, score: 70 },
      conversion: { ...pillar, score: 65 },
      trust: { ...pillar, score: 85 },
      competition: { ...pillar, score: 60 },
      growth_foundation: { ...pillar, score: 72 },
    },
    the_verdict: {
      status: "Ready",
      primary_constraint: "Competition",
      highest_opportunity: "Conversion",
      estimated_impact: "High",
    },
    priority_matrix: [
      { task: "Clarify differentiation", impact: "High", effort: "Low", why: "Grounded" },
    ],
    evidence_digests: [
      { sourceId: "S1", keyFindings: ["Finding"], relevantSignals: ["Signal"] },
    ],
  };
}

describe("canonical structured model output validation", () => {
  it("accepts the canonical grader contract before deterministic scoring", () => {
    const audit = validAudit();
    expect(
      parseAndValidateStructuredOutput({
        task: "grader",
        text: JSON.stringify(audit),
        schema: VERDICT_AUDIT_SCHEMA,
      })
    ).toEqual(audit);
    expect(computeOverallScore(audit.pillars)).toBe(73);
  });

  it.each([
    ["missing pillar", (audit: ReturnType<typeof validAudit>) => {
      delete (audit.pillars as Partial<typeof audit.pillars>).competition;
    }],
    ["out-of-range score", (audit: ReturnType<typeof validAudit>) => {
      audit.pillars.conversion.score = 101;
    }],
    ["invalid priority shape", (audit: ReturnType<typeof validAudit>) => {
      (audit.priority_matrix[0] as { impact?: unknown }).impact = 42;
    }],
    ["invalid source ID", (audit: ReturnType<typeof validAudit>) => {
      audit.evidence_digests[0].sourceId = "SOURCE-1";
    }],
  ])("rejects canonical grader output with %s", (_label, mutate) => {
    const audit = validAudit();
    mutate(audit);
    expect(() =>
      parseAndValidateStructuredOutput({
        task: "grader",
        text: JSON.stringify(audit),
        schema: VERDICT_AUDIT_SCHEMA,
      })
    ).toThrowError(expect.objectContaining({
      name: "AttemptLocalModelProviderError",
      category: "invalid_structured_output",
    }));
  });

  it("validates the existing audit Q&A contract", () => {
    const answer = {
      answer: "Grounded answer [S1]",
      citations: ["S1"],
      answerType: "evidence",
      confidence: "high",
      limitations: [],
    };
    expect(
      parseAndValidateStructuredOutput({
        task: "qa",
        text: JSON.stringify(answer),
        schema: AUDIT_QA_SCHEMA,
      })
    ).toEqual(answer);
    expect(() =>
      parseAndValidateStructuredOutput({
        task: "qa",
        text: JSON.stringify({ ...answer, confidence: "certain" }),
        schema: AUDIT_QA_SCHEMA,
      })
    ).toThrowError(expect.objectContaining({
      category: "invalid_structured_output",
    }));
  });

  it("classifies malformed JSON as attempt-local", () => {
    expect(() =>
      parseAndValidateStructuredOutput({
        task: "grader",
        text: "not-json",
        schema: VERDICT_AUDIT_SCHEMA,
      })
    ).toThrowError(expect.objectContaining({
      category: "malformed_json",
      telemetry: {},
    }));
  });
});
