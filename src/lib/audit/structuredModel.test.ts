import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AttemptLocalModelProviderError,
  ModelAvailabilityError,
  ModelProviderExhaustedError,
  TerminalModelProviderError,
  TransientModelProviderError,
  type AuditModelTask,
} from "./model";
import {
  GOOGLE_MIN_REQUEST_TIMEOUT_MS,
  MIN_MODEL_ATTEMPT_WINDOWS_MS,
  STRUCTURED_MODEL_OPERATION_TIMEOUTS,
  STRUCTURED_MODEL_POLICIES,
  googleProviderRequestTimeoutMs,
  runStructuredModelTask,
  type StructuredModelGenerator,
} from "./structuredModel";

const SCHEMA = { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } } };

function request(task: AuditModelTask, generate: StructuredModelGenerator) {
  return runStructuredModelTask({
    task,
    contents: "untrusted evidence sentinel",
    schema: SCHEMA,
    systemInstruction: "system sentinel",
    generate,
  });
}

describe("provider-neutral structured model policy", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps Google's manual deadline valid without widening Verdict budgets", () => {
    expect(GOOGLE_MIN_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(googleProviderRequestTimeoutMs(3_000)).toBe(10_000);
    expect(googleProviderRequestTimeoutMs(8_000)).toBe(10_000);
    expect(googleProviderRequestTimeoutMs(10_000)).toBe(10_000);
    expect(googleProviderRequestTimeoutMs(40_000)).toBe(40_000);
  });

  it("still enforces the three-second planner attempt outside the provider deadline", async () => {
    vi.useFakeTimers();
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockImplementationOnce(() => new Promise<string>(() => undefined))
      .mockResolvedValueOnce('{"ok":true}');

    const pending = request("planner", generate);
    await vi.advanceTimersByTimeAsync(3_000);
    const result = await pending;

    expect(result.metadata.model).toBe("deepseek-v4-flash");
    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
    ]);
    expect(generate.mock.calls[0][0].timeoutMs).toBe(3_000);
  });

  it.each([
    ["normalization", "deepseek-v4-flash"],
    ["planner", "deepseek-v4-flash"],
    ["admission", "deepseek-v4-flash"],
    ["grader", "deepseek-v4-flash"],
    ["qa", "deepseek-v4-flash"],
  ] as const)("uses provider-diverse bounded order for %s", async (task, deepseek) => {
    expect(
      STRUCTURED_MODEL_POLICIES[task].map(({ provider, model }) => ({
        provider,
        model,
      }))
    ).toEqual([
      { provider: "google", model: "gemini-3.7-flash" },
      { provider: "deepseek", model: deepseek },
      { provider: "google", model: "gemini-3.6-flash" },
    ]);

    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockResolvedValueOnce('{"ok":true}');
    const result = await request(task, generate);

    expect(generate.mock.calls.map(([call]) => [call.provider, call.model])).toEqual([
      ["google", "gemini-3.7-flash"],
      ["deepseek", deepseek],
      ["google", "gemini-3.6-flash"],
    ]);
    expect(result.metadata).toMatchObject({
      provider: "google",
      model: "gemini-3.6-flash",
      modelUsed: "gemini-3.6-flash",
      tier: "tertiary",
      fallbackUsed: true,
      availabilityErrorCategory: "timeout",
    });
  });

  it("keeps V4 Pro off every normal runtime policy", () => {
    expect(
      Object.values(STRUCTURED_MODEL_POLICIES)
        .flat()
        .map(({ model }) => model)
    ).not.toContain("deepseek-v4-pro");
  });

  it("does not call DeepSeek when Gemini primary succeeds", async () => {
    const generate = vi.fn<StructuredModelGenerator>().mockResolvedValue('{"ok":true}');
    const result = await request("grader", generate);

    expect(generate).toHaveBeenCalledOnce();
    expect(result.metadata).toMatchObject({
      provider: "google",
      model: "gemini-3.7-flash",
      tier: "primary",
      fallbackUsed: false,
    });
  });

  it("stops after DeepSeek succeeds and never calls Gemini 3.6", async () => {
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new Error("MODEL_HIGH_DEMAND"))
      .mockResolvedValueOnce('{"ok":true}');
    const result = await request("grader", generate);

    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
    ]);
    expect(result.metadata).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      tier: "secondary",
    });
  });

  it.each([
    ["incomplete_max_output_tokens", new AttemptLocalModelProviderError(
      "incomplete_max_output_tokens",
      {
        httpStatus: 200,
        finishReason: "length",
      }
    )],
    ["malformed_json", "not-json"],
  ] as const)(
    "continues to Gemini 3.6 after DeepSeek %s",
    async (_category, deepSeekResult) => {
      const generate = vi.fn<StructuredModelGenerator>();
      generate.mockRejectedValueOnce({ status: 503 });
      if (typeof deepSeekResult === "string") {
        generate.mockResolvedValueOnce(deepSeekResult);
      } else {
        generate.mockRejectedValueOnce(deepSeekResult);
      }
      generate.mockResolvedValueOnce('{"ok":true}');

      const result = await request("grader", generate);

      expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
        "gemini-3.7-flash",
        "deepseek-v4-flash",
        "gemini-3.6-flash",
      ]);
      expect(result.metadata).toMatchObject({
        provider: "google",
        model: "gemini-3.6-flash",
        tier: "tertiary",
      });
    }
  );

  it("uses heavyweight bounded grader limits without widening light tasks", () => {
    expect(
      STRUCTURED_MODEL_POLICIES.grader.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([40_000, 35_000, 30_000]);
    expect(STRUCTURED_MODEL_POLICIES.grader[1]).toMatchObject({
      malformedCorrectionTimeoutMs: 15_000,
    });
    expect(STRUCTURED_MODEL_POLICIES.grader[2]).toMatchObject({
      timeoutRetryMs: 10_000,
    });
    expect(STRUCTURED_MODEL_OPERATION_TIMEOUTS.grader).toBe(135_000);
    expect(MIN_MODEL_ATTEMPT_WINDOWS_MS.grader).toBe(5_000);

    expect(
      STRUCTURED_MODEL_POLICIES.normalization.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([8_000, 8_000, 6_000]);
    expect(
      STRUCTURED_MODEL_POLICIES.planner.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([3_000, 3_000, 1_500]);
    expect(
      STRUCTURED_MODEL_POLICIES.admission.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([2_500, 2_500, 1_500]);
    expect(
      STRUCTURED_MODEL_POLICIES.qa.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([10_000, 12_000, 8_000]);
    expect(STRUCTURED_MODEL_OPERATION_TIMEOUTS).toEqual({
      normalization: 23_000,
      planner: 8_000,
      admission: 6_500,
      grader: 135_000,
      qa: 31_000,
    });
  });

  it("passes each final grader its full configured bounded timeout", async () => {
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockRejectedValueOnce(
        new AttemptLocalModelProviderError("provider_timeout")
      )
      .mockResolvedValueOnce('{"ok":true}');

    await request("grader", generate);

    expect(generate.mock.calls.map(([call]) => call.timeoutMs)).toEqual([
      40_000,
      35_000,
      expect.any(Number),
    ]);
    expect(generate.mock.calls[2][0].timeoutMs).toBeGreaterThan(29_000);
    expect(generate.mock.calls[2][0].timeoutMs).toBeLessThanOrEqual(30_000);
  });

  it("accepts safely extracted JSON without spending a correction attempt", async () => {
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockResolvedValueOnce('prefix {"ok":true} suffix');

    const result = await request("grader", generate);

    expect(result.value).toBe('{"ok":true}');
    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
    ]);
  });

  it("runs one bounded DeepSeek correction for near-complete malformed grader JSON", async () => {
    const nearComplete = `{
      "company_name":"Example",
      "score_interpretation":"Ready",
      "pillars":{
        "positioning":{},"messaging":{},"website_ux":{},"conversion":{},
        "trust":{},"competition":{},"growth_foundation":{}
      },
      "the_verdict":{},"priority_matrix":[]`;
    const attempts: Array<{ retryKind?: string; safeCategory: string }> = [];
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockResolvedValueOnce(nearComplete)
      .mockResolvedValueOnce('{"ok":true}');

    const result = await runStructuredModelTask({
      task: "grader",
      contents: "untrusted evidence sentinel",
      schema: SCHEMA,
      systemInstruction: "system sentinel",
      generate,
      onAttempt: (attempt) => attempts.push(attempt),
    });

    expect(result.metadata.model).toBe("deepseek-v4-flash");
    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
      "deepseek-v4-flash",
    ]);
    expect(generate.mock.calls[2][0]).toMatchObject({ timeoutMs: 15_000 });
    expect(generate.mock.calls[2][0].systemInstruction).toContain(
      "one bounded structured-output correction pass"
    );
    expect(attempts.at(-1)).toMatchObject({
      result: "success",
      retryKind: "malformed_correction",
    });
  });

  it("falls through without correction when malformed output is incomplete", async () => {
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockResolvedValueOnce('{"pillars":{')
      .mockResolvedValueOnce('{"ok":true}');

    const result = await request("grader", generate);

    expect(result.metadata.model).toBe("gemini-3.6-flash");
    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
      "gemini-3.6-flash",
    ]);
  });

  it("falls through when the single malformed-output correction is still invalid", async () => {
    const nearComplete = `{
      "company_name":"Example","score_interpretation":"Ready",
      "pillars":{"positioning":{},"messaging":{},"website_ux":{},
      "conversion":{},"trust":{},"competition":{},"growth_foundation":{}},
      "the_verdict":{},"priority_matrix":[]`;
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockResolvedValueOnce(nearComplete)
      .mockResolvedValueOnce('{"ok":"still-invalid"}')
      .mockResolvedValueOnce('{"ok":true}');

    const result = await request("grader", generate);

    expect(result.metadata.model).toBe("gemini-3.6-flash");
    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
      "deepseek-v4-flash",
      "gemini-3.6-flash",
    ]);
  });

  it("retries only the last-tier grader timeout once within ten seconds", async () => {
    const attempts: Array<{ retryKind?: string; safeCategory: string }> = [];
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockRejectedValueOnce(
        new AttemptLocalModelProviderError("missing_output")
      )
      .mockRejectedValueOnce(new TransientModelProviderError("timeout"))
      .mockResolvedValueOnce('{"ok":true}');

    const result = await runStructuredModelTask({
      task: "grader",
      contents: "untrusted evidence sentinel",
      schema: SCHEMA,
      systemInstruction: "system sentinel",
      generate,
      onAttempt: (attempt) => attempts.push(attempt),
    });

    expect(result.metadata.model).toBe("gemini-3.6-flash");
    expect(generate.mock.calls.map(([call]) => call.model)).toEqual([
      "gemini-3.7-flash",
      "deepseek-v4-flash",
      "gemini-3.6-flash",
      "gemini-3.6-flash",
    ]);
    expect(generate.mock.calls[3][0].timeoutMs).toBeLessThanOrEqual(10_000);
    expect(attempts.at(-1)).toMatchObject({
      result: "success",
      retryKind: "timeout",
    });
  });

  it("does not switch provider for auth, schema, or application failures", async () => {
    for (const [error, safeCategory] of [
      [Object.assign(new Error("bad schema"), { status: 400 }), "invalid_request"],
      [Object.assign(new Error("bad key"), { status: 401 }), "authentication_error"],
      [Object.assign(new Error("denied"), { status: 403 }), "permission_error"],
      [new TypeError("developer bug"), "application"],
    ]) {
      const generate = vi.fn<StructuredModelGenerator>().mockRejectedValue(error);
      await expect(request("grader", generate)).rejects.toMatchObject({
        name: "TerminalModelProviderError",
        safeCategory,
        message: "MODEL_PROVIDER_TERMINAL_FAILURE",
      });
      expect(generate).toHaveBeenCalledOnce();
    }
  });

  it("keeps explicit application failures terminal instead of masking them", async () => {
    const error = new TerminalModelProviderError("application");
    const generate = vi.fn<StructuredModelGenerator>().mockRejectedValue(error);
    await expect(request("grader", generate)).rejects.toBe(error);
    expect(generate).toHaveBeenCalledOnce();
  });

  it("wraps provider INVALID_ARGUMENT as a safe application/configuration failure", async () => {
    const raw = Object.assign(
      new Error(
        '{"error":{"code":400,"message":"Manually set deadline 8s is too short. Minimum allowed deadline is 10s.","status":"INVALID_ARGUMENT"}}'
      ),
      { name: "ApiError", status: 400 }
    );
    const attempts: Array<{ safeCategory: string; httpStatus?: number }> = [];
    const generate = vi.fn<StructuredModelGenerator>().mockRejectedValue(raw);

    await expect(
      runStructuredModelTask({
        task: "normalization",
        contents: "input",
        schema: SCHEMA,
        systemInstruction: "system",
        generate,
        onAttempt: (attempt) => attempts.push(attempt),
      })
    ).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory: "application",
      message: "MODEL_PROVIDER_TERMINAL_FAILURE",
    });
    expect(attempts).toEqual([
      expect.objectContaining({
        safeCategory: "application",
        httpStatus: 400,
      }),
    ]);
  });

  it("normalizes bounded all-provider availability failure", async () => {
    const generate = vi.fn<StructuredModelGenerator>().mockRejectedValue({ status: 503 });
    await expect(request("grader", generate)).rejects.toBeInstanceOf(
      ModelAvailabilityError
    );
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("fails safely when every provider returns unusable structured output", async () => {
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce("not-json")
      .mockResolvedValueOnce('{"ok":"not-a-boolean"}');

    await expect(request("grader", generate)).rejects.toMatchObject({
      name: "ModelProviderExhaustedError",
      category: "invalid_structured_output",
    } satisfies Partial<ModelProviderExhaustedError>);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("does not start an attempt when the operation has no usable time", async () => {
    const generate = vi.fn<StructuredModelGenerator>().mockResolvedValue("{}");
    await expect(
      runStructuredModelTask({
        task: "planner",
        contents: "input",
        schema: SCHEMA,
        systemInstruction: "system",
        deadlineAt: Date.now() + 100,
        generate,
      })
    ).rejects.toMatchObject({ category: "timeout" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("enforces the total grader deadline before starting a provider", async () => {
    const generate = vi.fn<StructuredModelGenerator>().mockResolvedValue('{"ok":true}');
    await expect(
      runStructuredModelTask({
        task: "grader",
        contents: "input",
        schema: SCHEMA,
        systemInstruction: "system",
        deadlineAt: Date.now() + MIN_MODEL_ATTEMPT_WINDOWS_MS.grader - 1,
        generate,
      })
    ).rejects.toMatchObject({ category: "timeout" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("logs safe structured attempt fields without prompts, evidence, or errors", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const generate = vi.fn<StructuredModelGenerator>().mockResolvedValue("{}");
    await request("normalization", generate);

    const serialized = String(info.mock.calls[0][0]);
    expect(serialized).toContain('"task":"normalization"');
    expect(serialized).toContain('"provider":"google"');
    expect(serialized).toContain('"result":"success"');
    expect(serialized).toContain('"classification":"success"');
    expect(serialized).not.toContain("untrusted evidence sentinel");
    expect(serialized).not.toContain("system sentinel");
  });

  it("logs only safe DeepSeek response state for incomplete output", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const generate = vi
      .fn<StructuredModelGenerator>()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce(
        new AttemptLocalModelProviderError("incomplete_max_output_tokens", {
          httpStatus: 200,
          finishReason: "length",
        })
      )
      .mockResolvedValueOnce('{"ok":true}');

    await request("grader", generate);
    const serialized = info.mock.calls.map(([line]) => String(line)).join("\n");

    expect(serialized).toContain('"httpStatus":200');
    expect(serialized).toContain('"finishReason":"length"');
    expect(serialized).toContain('"classification":"attempt_local"');
    expect(serialized).not.toContain("providerStatus");
    expect(serialized).not.toContain("outputTextPresent");
    expect(serialized).not.toContain("jsonParsed");
    expect(serialized).not.toContain("untrusted evidence sentinel");
    expect(serialized).not.toContain("system sentinel");
  });
});
