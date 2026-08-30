import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEEPSEEK_OUTPUT_TOKEN_LIMITS,
  DEEPSEEK_REASONING_EFFORT,
  DEEPSEEK_RESPONSES_URL,
  generateDeepSeekStructuredJson,
  parseDeepSeekResponsePayload,
  toDeepSeekJsonSchema,
} from "./deepseek";

const originalApiKey = process.env.DEEPSEEK_API_KEY;

function okResponse(text: string) {
  return new Response(
    JSON.stringify({
      status: "completed",
      model: "deepseek-v4-pro",
      output: [
        { type: "reasoning", content: "PRIVATE_REASONING_SENTINEL" },
        {
          type: "message",
          content: [{ type: "output_text", text }],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("DeepSeek audit Responses adapter", () => {
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
    ["normalization", "deepseek-v4-flash", "none"],
    ["planner", "deepseek-v4-flash", "low"],
    ["grader", "deepseek-v4-flash", "low"],
    ["qa", "deepseek-v4-flash", "low"],
  ] as const)(
    "uses Responses JSON Schema with task policy for %s",
    async (task, model, effort) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse('{"ok":true}'));
      vi.stubGlobal("fetch", fetchMock);
      const schema = {
        type: "OBJECT",
        properties: { ok: { type: "BOOLEAN" } },
        required: ["ok"],
      };

      const result = await generateDeepSeekStructuredJson({
        task,
        model,
        contents: "evidence",
        schema,
        systemInstruction: "system",
        timeoutMs: 1_000,
      });

      expect(result).toBe('{"ok":true}');
      expect(result).not.toContain("PRIVATE_REASONING_SENTINEL");
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(DEEPSEEK_RESPONSES_URL);
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model,
        instructions: "system",
        input: "evidence",
        reasoning: { effort },
        text: {
          format: {
            type: "json_schema",
            name: `verdict_${task}`,
            schema: {
              type: "object",
              properties: { ok: { type: "boolean" } },
              required: ["ok"],
            },
          },
        },
        stream: false,
        store: false,
      });
      expect(body.text.format).not.toHaveProperty("strict");
      expect(body.reasoning.effort).not.toBe("high");
    }
  );

  it("keeps every task explicit and within bounded output limits", () => {
    expect(DEEPSEEK_REASONING_EFFORT).toEqual({
      normalization: "none",
      planner: "low",
      grader: "low",
      qa: "low",
    });
    expect(DEEPSEEK_OUTPUT_TOKEN_LIMITS).toEqual({
      normalization: 800,
      planner: 1_600,
      grader: 5_000,
      qa: 2_400,
    });
    for (const effort of Object.values(DEEPSEEK_REASONING_EFFORT)) {
      expect(effort).not.toBe("high");
      expect(effort).not.toBe("max");
    }
  });

  it("parses completed non-streaming JSON with keep-alive whitespace", async () => {
    const payload = {
      status: "completed",
      model: "deepseek-v4-pro",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"ok":true}' }],
        },
      ],
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`\n\n  ${JSON.stringify(payload)}  \n\n`, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateDeepSeekStructuredJson({
        task: "grader",
        model: "deepseek-v4-pro",
        contents: "evidence",
        schema: { type: "OBJECT" },
        systemInstruction: "system",
        timeoutMs: 1_000,
      })
    ).resolves.toBe('{"ok":true}');
  });

  it("handles documented incomplete and failed response states safely", () => {
    expect(() =>
      parseDeepSeekResponsePayload({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [],
      })
    ).toThrowError(expect.objectContaining({
      name: "TerminalModelProviderError",
      safeCategory: "invalid_response",
    }));
    expect(() =>
      parseDeepSeekResponsePayload({
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
        output: [],
      })
    ).toThrowError(expect.objectContaining({
      safeCategory: "content_safety",
    }));
    expect(() =>
      parseDeepSeekResponsePayload({
        status: "failed",
        error: { code: "server_error", message: "private detail" },
        output: [],
      })
    ).toThrowError(expect.objectContaining({
      name: "TransientModelProviderError",
      category: "unavailable",
    }));
    expect(() =>
      parseDeepSeekResponsePayload({
        status: "failed",
        error: { code: "invalid_request_error", message: "private detail" },
        output: [],
      })
    ).toThrowError(expect.objectContaining({
      name: "TerminalModelProviderError",
      safeCategory: "application",
    }));
  });

  it("keeps request timeout fallback-eligible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(
        new DOMException("timed out", "TimeoutError")
      )
    );
    await expect(
      generateDeepSeekStructuredJson({
        task: "grader",
        model: "deepseek-v4-pro",
        contents: "evidence",
        schema: { type: "OBJECT" },
        systemInstruction: "system",
        timeoutMs: 1,
      })
    ).rejects.toMatchObject({
      name: "TransientModelProviderError",
      category: "timeout",
    });
  });

  it("maps temporary HTTP and transport failures into fallback-eligible errors", async () => {
    for (const response of [
      new Response(null, { status: 429 }),
      new Response(null, { status: 503 }),
    ]) {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
      await expect(
        generateDeepSeekStructuredJson({
          task: "grader",
          model: "deepseek-v4-pro",
          contents: "evidence",
          schema: { type: "OBJECT" },
          systemInstruction: "system",
          timeoutMs: 1_000,
        })
      ).rejects.toMatchObject({ name: "TransientModelProviderError" });
    }
  });

  it("keeps auth and malformed structured responses terminal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }))
    );
    await expect(
      generateDeepSeekStructuredJson({
        task: "grader",
        model: "deepseek-v4-pro",
        contents: "evidence",
        schema: { type: "OBJECT" },
        systemInstruction: "system",
        timeoutMs: 1_000,
      })
    ).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory: "authentication",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: "completed", output: [{ type: "reasoning" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    await expect(
      generateDeepSeekStructuredJson({
        task: "grader",
        model: "deepseek-v4-pro",
        contents: "evidence",
        schema: { type: "OBJECT" },
        systemInstruction: "system",
        timeoutMs: 1_000,
      })
    ).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory: "invalid_response",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(okResponse("not-json"))
    );
    await expect(
      generateDeepSeekStructuredJson({
        task: "grader",
        model: "deepseek-v4-pro",
        contents: "evidence",
        schema: { type: "OBJECT" },
        systemInstruction: "system",
        timeoutMs: 1_000,
      })
    ).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory: "invalid_response",
    });
  });

  it("fails safely without a server-side API key", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      generateDeepSeekStructuredJson({
        task: "planner",
        model: "deepseek-v4-flash",
        contents: "evidence",
        schema: { type: "OBJECT" },
        systemInstruction: "system",
        timeoutMs: 1_000,
      })
    ).rejects.toMatchObject({
      name: "TerminalModelProviderError",
      safeCategory: "authentication",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
