import { describe, expect, it } from "vitest";
import { ThinkingLevel } from "@google/genai";
import {
  AUDIT_MODEL,
  AUDIT_THINKING_LEVELS,
  createAuditGenerationConfig,
} from "./model";

describe("Gemini audit model configuration", () => {
  it("uses Gemini 3.7 Flash with task-appropriate thinking", () => {
    expect(AUDIT_MODEL).toBe("gemini-3.7-flash");
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
});
