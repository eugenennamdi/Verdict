import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  DEEPSEEK_OUTPUT_TOKEN_LIMITS,
  DEEPSEEK_REASONING_POLICY,
  generateDeepSeekStructuredJson,
  parseDeepSeekChatCompletionPayload,
  toDeepSeekJsonSchema,
} from "./deepseek";
import type { AuditModelTask } from "./model";

const originalApiKey = process.env.DEEPSEEK_API_KEY;
const schema = {
  type: "OBJECT",
  properties: { ok: { type: "BOOLEAN" } },
  required: ["ok"],
};

function chatResponse(
  content: string | null,
  finishReason = "stop",
  status = 200
) {
  return new Response(
    JSON.stringify({
      id: "safe-test-id",
      object: "chat.completion",
      model: "deepseek-v4-flash",
      choices: [
        {
          index: 0,
          finish_reason: finishReason,
          message: {
            role: "assistant",
            content,
            reasoning_content: "PRIVATE_REASONING_SENTINEL",
          },
        },
      ],
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function request(task: AuditModelTask, timeoutMs = 1_000) {
  return generateDeepSeekStructuredJson({
    task,
    model: "deepseek-v4-flash",
    contents: "untrusted evidence sentinel",
    schema,
    systemInstruction: "system sentinel",
    timeoutMs,
  });
}

describe("DeepSeek audit Chat Completions adapter", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key-sentinel";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalApiKey;
  });

  it("maps the canonical schema without changing its fields or required contract", () => {
    expect(
      toDeepSeekJsonSchema({
        type: "OBJECT",
        properties: {
          score: { type: "INTEGER" },
          citations: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["score", "citations"],
      })
    ).toEqual({
      type: "object",
      properties: {
        score: { type: "integer" },
        citations: { type: "array", items: { type: "string" } },
      },
      required: ["score", "citations"],
    });
  });

  it.each([
    ["normalization", "disabled", undefined, 800],
    ["planner", "enabled", "low", 1_600],
    ["grader", "enabled", "low", 5_000],
    ["qa", "enabled", "low", 2_400],
  ] as const)(
    "uses Chat Completions JSON mode with bounded policy for %s",
    async (task, thinking, effort, maxTokens) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(chatResponse('{"ok":true}'));
      vi.stubGlobal("fetch", fetchMock);

      const result = await request(task);

      expect(result).toEqual({
        text: '{"ok":true}',
        telemetry: {
          httpStatus: 200,
          finishReason: "stop",
        },
      });
      expect(result.text).not.toContain("PRIVATE_REASONING_SENTINEL");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(DEEPSEEK_CHAT_COMPLETIONS_URL);
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: "deepseek-v4-flash",
        thinking: { type: thinking },
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        stream: false,
      });
      if (effort) expect(body.reasoning_effort).toBe(effort);
      else expect(body).not.toHaveProperty("reasoning_effort");
      expect(body).not.toHaveProperty("max_output_tokens");
      expect(body).not.toHaveProperty("text.format");
      expect(body.messages[0]).toMatchObject({ role: "system" });
      expect(body.messages[0].content).toContain("Return valid JSON only");
      expect(body.messages[0].content).toContain("Verdict output contract");
      expect(body.messages[0].content).toContain("Do not use markdown fences");
      expect(body.messages[0].content).toContain('"ok"');
      expect(body.messages[1]).toEqual({
        role: "user",
        content: "untrusted evidence sentinel",
      });
    }
  );

  it("keeps every task explicit and avoids high reasoning", () => {
    expect(DEEPSEEK_REASONING_POLICY).toEqual({
      normalization: { thinking: "disabled" },
      planner: { thinking: "enabled", effort: "low" },
      grader: { thinking: "enabled", effort: "low" },
      qa: { thinking: "enabled", effort: "low" },
    });
    expect(DEEPSEEK_OUTPUT_TOKEN_LIMITS).toEqual({
      normalization: 800,
      planner: 1_600,
      grader: 5_000,
      qa: 2_400,
    });
  });

  it("accepts only stop with non-empty syntactically valid JSON", () => {
    expect(
      parseDeepSeekChatCompletionPayload({
        choices: [
          {
            finish_reason: "stop",
            message: { content: '  {"ok":true}  ' },
          },
        ],
      })
    ).toEqual({
      text: '{"ok":true}',
      telemetry: { httpStatus: 200, finishReason: "stop" },
    });
  });

  it.each([
    ["length", "incomplete_max_output_tokens"],
    ["insufficient_system_resource", "provider_unavailable"],
    ["tool_calls", "unexpected_response_status"],
  ] as const)(
    "keeps finish_reason=%s attempt-local",
    (finishReason, category) => {
      expect(() =>
        parseDeepSeekChatCompletionPayload({
          choices: [
            {
              finish_reason: finishReason,
              message: { content: '{"ok":true}' },
            },
          ],
        })
      ).toThrowError(
        expect.objectContaining({
          name: "AttemptLocalModelProviderError",
          category,
          telemetry: expect.objectContaining({ finishReason }),
        })
      );
    }
  );

  it("classifies empty content and malformed JSON as attempt-local", () => {
    for (const [content, category] of [
      ["", "missing_output"],
      ["not-json", "malformed_json"],
    ] as const) {
      expect(() =>
        parseDeepSeekChatCompletionPayload({
          choices: [{ finish_reason: "stop", message: { content } }],
        })
      ).toThrowError(
        expect.objectContaining({
          name: "AttemptLocalModelProviderError",
          category,
          telemetry: expect.objectContaining({ finishReason: "stop" }),
        })
      );
    }
  });

  it("keeps content filtering terminal", () => {
    expect(() =>
      parseDeepSeekChatCompletionPayload({
        choices: [
          { finish_reason: "content_filter", message: { content: null } },
        ],
      })
    ).toThrowError(
      expect.objectContaining({
        name: "TerminalModelProviderError",
        safeCategory: "content_safety",
      })
    );
  });

  it.each([
    [401, "authentication_error"],
    [403, "permission_error"],
    [400, "invalid_request"],
    [422, "invalid_request"],
  ] as const)("keeps HTTP %s globally terminal", async (status, safeCategory) => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }))
    );

    await expect(request("grader")).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory,
      telemetry: { httpStatus: status },
    });
  });

  it("keeps safety error envelopes globally terminal", () => {
    expect(() =>
      parseDeepSeekChatCompletionPayload({
        error: { code: "content_filter", message: "private provider detail" },
      })
    ).toThrowError(
      expect.objectContaining({
        name: "TerminalModelProviderError",
        safeCategory: "content_safety",
      })
    );
  });

  it("keeps request timeout and temporary provider failures fallback-eligible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(
        new DOMException("timed out", "TimeoutError")
      )
    );
    await expect(request("grader", 1)).rejects.toMatchObject({
      name: "AttemptLocalModelProviderError",
      category: "provider_timeout",
    });

    for (const status of [429, 503]) {
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }))
      );
      await expect(request("grader")).rejects.toMatchObject({
        name: expect.stringMatching(
          /(?:Transient|AttemptLocal)ModelProviderError/
        ),
      });
    }
  });

  it("fails safely without a server-side API key", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("planner")).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory: "authentication_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
