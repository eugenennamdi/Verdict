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
  MIN_MODEL_ATTEMPT_WINDOWS_MS,
  STRUCTURED_MODEL_OPERATION_TIMEOUTS,
  STRUCTURED_MODEL_POLICIES,
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
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["normalization", "deepseek-v4-flash"],
    ["planner", "deepseek-v4-flash"],
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
    ).toEqual([35_000, 25_000, 20_000]);
    expect(STRUCTURED_MODEL_OPERATION_TIMEOUTS.grader).toBe(80_000);
    expect(MIN_MODEL_ATTEMPT_WINDOWS_MS.grader).toBe(5_000);

    expect(
      STRUCTURED_MODEL_POLICIES.normalization.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([8_000, 8_000, 6_000]);
    expect(
      STRUCTURED_MODEL_POLICIES.planner.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([3_000, 3_000, 1_500]);
    expect(
      STRUCTURED_MODEL_POLICIES.qa.map(({ timeoutMs }) => timeoutMs)
    ).toEqual([10_000, 12_000, 8_000]);
    expect(STRUCTURED_MODEL_OPERATION_TIMEOUTS).toEqual({
      normalization: 23_000,
      planner: 8_000,
      grader: 80_000,
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
      35_000,
      25_000,
      expect.any(Number),
    ]);
    expect(generate.mock.calls[2][0].timeoutMs).toBeGreaterThan(19_000);
    expect(generate.mock.calls[2][0].timeoutMs).toBeLessThanOrEqual(20_000);
  });

  it("does not switch provider for auth, schema, or application failures", async () => {
    for (const error of [
      Object.assign(new Error("bad schema"), { status: 400 }),
      Object.assign(new Error("bad key"), { status: 401 }),
      Object.assign(new Error("denied"), { status: 403 }),
      new TypeError("developer bug"),
    ]) {
      const generate = vi.fn<StructuredModelGenerator>().mockRejectedValue(error);
      await expect(request("grader", generate)).rejects.toBe(error);
      expect(generate).toHaveBeenCalledOnce();
    }
  });

  it("keeps explicit application failures terminal instead of masking them", async () => {
    const error = new TerminalModelProviderError("application");
    const generate = vi.fn<StructuredModelGenerator>().mockRejectedValue(error);
    await expect(request("grader", generate)).rejects.toBe(error);
    expect(generate).toHaveBeenCalledOnce();
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
