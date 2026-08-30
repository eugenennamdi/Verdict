import { describe, expect, it, vi } from "vitest";
import { ThinkingLevel } from "@google/genai";
import {
  AUDIT_MODEL,
  FALLBACK_AUDIT_MODEL,
  PRIMARY_AUDIT_MODEL,
  AUDIT_THINKING_LEVELS,
  classifyTransientGeminiAvailabilityError,
  createAuditGenerationConfig,
  runAuditModelWithAvailabilityFailover,
} from "./model";

describe("Gemini audit model configuration", () => {
  it("uses Gemini 3.7 Flash with task-appropriate thinking", () => {
    expect(AUDIT_MODEL).toBe("gemini-3.7-flash");
    expect(PRIMARY_AUDIT_MODEL).toBe("gemini-3.7-flash");
    expect(FALLBACK_AUDIT_MODEL).toBe("gemini-3.6-flash");
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

  it("uses 3.7 first and never calls 3.6 on primary success", async () => {
    const generate = vi.fn(async () => "ok");

    const result = await runAuditModelWithAvailabilityFailover({
      task: "grader",
      generate,
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith("gemini-3.7-flash");
    expect(result.metadata).toEqual({
      requestedPrimaryModel: "gemini-3.7-flash",
      modelUsed: "gemini-3.7-flash",
      fallbackUsed: false,
    });
  });

  it("retries 3.7 once, then uses 3.6 once for transient availability", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("MODEL_HIGH_DEMAND"))
      .mockRejectedValueOnce({ status: 503, code: "UNAVAILABLE" })
      .mockResolvedValueOnce("fallback result");

    const result = await runAuditModelWithAvailabilityFailover({
      task: "normalization",
      generate,
    });

    expect(generate.mock.calls.map(([model]) => model)).toEqual([
      "gemini-3.7-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
    ]);
    expect(result).toEqual({
      value: "fallback result",
      metadata: {
        requestedPrimaryModel: "gemini-3.7-flash",
        modelUsed: "gemini-3.6-flash",
        fallbackUsed: true,
        availabilityErrorCategory: "unavailable",
      },
    });
  });

  it("recognizes structured availability statuses without treating ordinary 4xx as eligible", () => {
    expect(classifyTransientGeminiAvailabilityError({ status: 503 })).toBe(
      "unavailable"
    );
    expect(
      classifyTransientGeminiAvailabilityError({ code: "UNAVAILABLE" })
    ).toBe("unavailable");
    expect(classifyTransientGeminiAvailabilityError({ status: 429 })).toBe(
      "rate_limited"
    );
    for (const status of [400, 401, 403]) {
      expect(classifyTransientGeminiAvailabilityError({ status })).toBeNull();
    }
  });

  it("does not retry malformed schema, authentication, or coding errors", async () => {
    for (const error of [
      Object.assign(new Error("Malformed response schema"), { status: 400 }),
      Object.assign(new Error("Invalid API key"), { status: 401 }),
      Object.assign(new Error("Permission denied"), { status: 403 }),
      new TypeError("Developer coding error"),
    ]) {
      const generate = vi.fn(async () => {
        throw error;
      });
      await expect(
        runAuditModelWithAvailabilityFailover({ task: "qa", generate })
      ).rejects.toBe(error);
      expect(generate).toHaveBeenCalledOnce();
    }
  });

  it("keeps all-model failure bounded and safely normalized", async () => {
    const generate = vi.fn(async () => {
      throw Object.assign(new Error("provider capacity"), { status: 503 });
    });

    await expect(
      runAuditModelWithAvailabilityFailover({ task: "grader", generate })
    ).rejects.toMatchObject({
      name: "GeminiAvailabilityError",
      message: "MODEL_HIGH_DEMAND",
      category: "unavailable",
    });
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("does not start another model attempt after an operation deadline closes", async () => {
    const generate = vi.fn(async () => {
      throw new Error("TIMEOUT_ERROR");
    });

    await expect(
      runAuditModelWithAvailabilityFailover({
        task: "planner",
        generate,
        canAttempt: () => false,
      })
    ).rejects.toMatchObject({
      message: "MODEL_HIGH_DEMAND",
      category: "timeout",
    });
    expect(generate).toHaveBeenCalledOnce();
  });
});
