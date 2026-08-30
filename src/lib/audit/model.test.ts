import { describe, expect, it } from "vitest";
import { ThinkingLevel } from "@google/genai";
import {
  AttemptLocalModelProviderError,
  AUDIT_MODEL,
  AUDIT_THINKING_LEVELS,
  DEEPSEEK_FLASH_AUDIT_MODEL,
  DEEPSEEK_PRO_AUDIT_MODEL,
  FALLBACK_AUDIT_MODEL,
  PRIMARY_AUDIT_MODEL,
  TransientModelProviderError,
  classifyAttemptLocalModelError,
  classifyTransientModelError,
  createAuditGenerationConfig,
} from "./model";

describe("audit model contracts", () => {
  it("keeps Gemini primary and exposes the two DeepSeek task models", () => {
    expect(AUDIT_MODEL).toBe("gemini-3.7-flash");
    expect(PRIMARY_AUDIT_MODEL).toBe("gemini-3.7-flash");
    expect(FALLBACK_AUDIT_MODEL).toBe("gemini-3.6-flash");
    expect(DEEPSEEK_FLASH_AUDIT_MODEL).toBe("deepseek-v4-flash");
    expect(DEEPSEEK_PRO_AUDIT_MODEL).toBe("deepseek-v4-pro");
    expect(AUDIT_THINKING_LEVELS).toEqual({
      normalization: ThinkingLevel.LOW,
      planner: ThinkingLevel.LOW,
      grader: ThinkingLevel.MEDIUM,
      qa: ThinkingLevel.MEDIUM,
    });
  });

  it("keeps structured output and excludes deprecated generation controls", () => {
    const config = createAuditGenerationConfig(
      "grader",
      { type: "OBJECT" },
      "system"
    );

    expect(config).toMatchObject({
      systemInstruction: "system",
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: "application/json",
    });
    for (const key of [
      "temperature",
      "topP",
      "topK",
      "candidateCount",
      "thinkingBudget",
    ]) {
      expect(config).not.toHaveProperty(key);
    }
  });

  it("classifies only temporary capacity, timeout, and transport failures", () => {
    expect(classifyTransientModelError({ status: 503 })).toBe("unavailable");
    expect(classifyTransientModelError({ code: "UNAVAILABLE" })).toBe(
      "unavailable"
    );
    expect(classifyTransientModelError({ status: 429 })).toBe("rate_limited");
    expect(classifyTransientModelError(new Error("MODEL_HIGH_DEMAND"))).toBe(
      "high_demand"
    );
    expect(classifyTransientModelError(new Error("MODEL_ATTEMPT_TIMEOUT"))).toBe(
      "timeout"
    );
    expect(
      classifyTransientModelError(new TransientModelProviderError("transport"))
    ).toBe("transport");
    for (const status of [400, 401, 403, 422]) {
      expect(classifyTransientModelError({ status })).toBeNull();
    }
    expect(classifyTransientModelError(new TypeError("Developer bug"))).toBeNull();
  });

  it("centralizes fallback-eligible provider output failures", () => {
    for (const category of [
      "incomplete_max_output_tokens",
      "incomplete_other",
      "missing_output",
      "malformed_json",
      "unexpected_response_status",
      "invalid_structured_output",
    ] as const) {
      expect(
        classifyAttemptLocalModelError(
          new AttemptLocalModelProviderError(category)
        )
      ).toBe(category);
    }
  });
});
