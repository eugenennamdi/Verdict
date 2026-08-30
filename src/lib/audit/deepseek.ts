import "server-only";

import {
  AttemptLocalModelProviderError,
  TerminalModelProviderError,
  TransientModelProviderError,
  type AuditModelTask,
  type ModelAttemptTelemetry,
  type ModelFinishReason,
} from "@/lib/audit/model";

export const DEEPSEEK_CHAT_COMPLETIONS_URL =
  "https://api.deepseek.com/chat/completions";

export const DEEPSEEK_REASONING_POLICY: Readonly<
  Record<AuditModelTask, { thinking: "enabled" | "disabled"; effort?: "low" }>
> = Object.freeze({
  normalization: { thinking: "disabled" },
  planner: { thinking: "enabled", effort: "low" },
  grader: { thinking: "enabled", effort: "low" },
  qa: { thinking: "enabled", effort: "low" },
});

export const DEEPSEEK_OUTPUT_TOKEN_LIMITS: Readonly<
  Record<AuditModelTask, number>
> = Object.freeze({
  normalization: 800,
  planner: 1_600,
  grader: 5_000,
  qa: 2_400,
});

const JSON_SCHEMA_TYPE_MAP: Readonly<Record<string, string>> = Object.freeze({
  OBJECT: "object",
  ARRAY: "array",
  STRING: "string",
  INTEGER: "integer",
  NUMBER: "number",
  BOOLEAN: "boolean",
  NULL: "null",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Convert the Google schema enum spelling into ordinary JSON Schema. */
export function toDeepSeekJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toDeepSeekJsonSchema);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key === "type" && typeof item === "string") {
        return [key, JSON_SCHEMA_TYPE_MAP[item] ?? item.toLowerCase()];
      }
      return [key, toDeepSeekJsonSchema(item)];
    })
  );
}

function terminalCategoryForStatus(
  status: number
): TerminalModelProviderError["safeCategory"] {
  if (status === 401) return "authentication_error";
  if (status === 403) return "permission_error";
  if ([400, 404, 405, 409, 422].includes(status)) return "invalid_request";
  return "application";
}

function safeFinishReason(value: unknown): ModelFinishReason {
  if (
    value === "stop" ||
    value === "length" ||
    value === "content_filter" ||
    value === "tool_calls" ||
    value === "insufficient_system_resource"
  ) {
    return value;
  }
  return "other";
}

function classifyProviderError(
  payload: Record<string, unknown>,
  telemetry: ModelAttemptTelemetry
): never {
  const error = isRecord(payload.error) ? payload.error : {};
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (/rate.?limit|too_many_requests/.test(code)) {
    throw new TransientModelProviderError("rate_limited", telemetry);
  }
  if (/timeout|deadline/.test(code)) {
    throw new AttemptLocalModelProviderError("provider_timeout", telemetry);
  }
  if (/unavailable|server|overload|insufficient_system_resource/.test(code)) {
    throw new AttemptLocalModelProviderError("provider_unavailable", telemetry);
  }
  if (/auth|api.?key/.test(code)) {
    throw new TerminalModelProviderError(
      "authentication_error",
      undefined,
      telemetry
    );
  }
  if (/permission|forbidden/.test(code)) {
    throw new TerminalModelProviderError(
      "permission_error",
      undefined,
      telemetry
    );
  }
  if (/content.?filter|safety|blocked/.test(code)) {
    throw new TerminalModelProviderError("content_safety", undefined, telemetry);
  }
  if (/invalid.?request|unsupported|unknown.?model|schema/.test(code)) {
    throw new TerminalModelProviderError("invalid_request", undefined, telemetry);
  }
  throw new AttemptLocalModelProviderError(
    "unexpected_response_status",
    telemetry
  );
}

export type DeepSeekStructuredResult = {
  text: string;
  telemetry: ModelAttemptTelemetry;
};

export function parseDeepSeekChatCompletionPayload(
  payload: unknown,
  httpStatus = 200
): DeepSeekStructuredResult {
  const baseTelemetry: ModelAttemptTelemetry = { httpStatus };
  if (!isRecord(payload)) {
    throw new AttemptLocalModelProviderError("malformed_json", baseTelemetry);
  }
  if (isRecord(payload.error)) classifyProviderError(payload, baseTelemetry);

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  if (!isRecord(choice)) {
    throw new AttemptLocalModelProviderError("missing_output", baseTelemetry);
  }

  const finishReason = safeFinishReason(choice.finish_reason);
  const telemetry: ModelAttemptTelemetry = { ...baseTelemetry, finishReason };
  if (finishReason === "length") {
    throw new AttemptLocalModelProviderError(
      "incomplete_max_output_tokens",
      telemetry
    );
  }
  if (finishReason === "insufficient_system_resource") {
    throw new AttemptLocalModelProviderError("provider_unavailable", telemetry);
  }
  if (finishReason === "content_filter") {
    throw new TerminalModelProviderError(
      "content_safety",
      undefined,
      telemetry
    );
  }
  if (finishReason !== "stop") {
    throw new AttemptLocalModelProviderError(
      "unexpected_response_status",
      telemetry
    );
  }

  const message = isRecord(choice.message) ? choice.message : {};
  const content =
    typeof message.content === "string" ? message.content.trim() : "";
  if (!content) {
    throw new AttemptLocalModelProviderError("missing_output", telemetry);
  }

  try {
    JSON.parse(content);
  } catch {
    throw new AttemptLocalModelProviderError("malformed_json", telemetry);
  }

  return { text: content, telemetry };
}

export type DeepSeekStructuredRequest = {
  task: AuditModelTask;
  model: "deepseek-v4-flash";
  contents: string;
  schema: unknown;
  systemInstruction: string;
  timeoutMs: number;
};

function deepSeekJsonSystemInstruction(request: DeepSeekStructuredRequest) {
  return `${request.systemInstruction}

Return valid JSON only. Conform exactly to the supplied Verdict output contract.
Do not use markdown fences. Do not include commentary outside the JSON object.
The provider JSON mode guarantees syntax only; Verdict will validate this
application contract independently after the response:
${JSON.stringify(toDeepSeekJsonSchema(request.schema))}`;
}

export function buildDeepSeekStructuredRequestBody(
  request: DeepSeekStructuredRequest
) {
  const reasoning = DEEPSEEK_REASONING_POLICY[request.task];
  return {
    model: request.model,
    messages: [
      {
        role: "system" as const,
        content: deepSeekJsonSystemInstruction(request),
      },
      { role: "user" as const, content: request.contents },
    ],
    thinking: { type: reasoning.thinking },
    ...(reasoning.effort ? { reasoning_effort: reasoning.effort } : {}),
    max_tokens: DEEPSEEK_OUTPUT_TOKEN_LIMITS[request.task],
    response_format: { type: "json_object" as const },
    stream: false,
  };
}

export async function generateDeepSeekStructuredJson(
  request: DeepSeekStructuredRequest
): Promise<DeepSeekStructuredResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new TerminalModelProviderError("authentication_error");
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDeepSeekStructuredRequestBody(request)),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (/AbortError|TimeoutError/i.test(name)) {
      throw new AttemptLocalModelProviderError("provider_timeout");
    }
    if (error instanceof TypeError) {
      throw new TransientModelProviderError("transport");
    }
    throw error;
  }

  if (!response.ok) {
    const telemetry = { httpStatus: response.status };
    if (response.status === 429) {
      throw new TransientModelProviderError("rate_limited", telemetry);
    }
    if (response.status === 408 || response.status === 504) {
      throw new AttemptLocalModelProviderError("provider_timeout", telemetry);
    }
    if (response.status >= 500 && response.status <= 599) {
      throw new AttemptLocalModelProviderError("provider_unavailable", telemetry);
    }
    throw new TerminalModelProviderError(
      terminalCategoryForStatus(response.status),
      undefined,
      telemetry
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AttemptLocalModelProviderError("malformed_json", {
      httpStatus: response.status,
    });
  }

  return parseDeepSeekChatCompletionPayload(payload, response.status);
}
