import "server-only";

import {
  TerminalModelProviderError,
  TransientModelProviderError,
  type AuditModelTask,
} from "@/lib/audit/model";

export const DEEPSEEK_RESPONSES_URL = "https://api.deepseek.com/responses";

export const DEEPSEEK_REASONING_EFFORT: Readonly<
  Record<AuditModelTask, "none" | "low">
> = Object.freeze({
  normalization: "none",
  planner: "low",
  grader: "low",
  qa: "low",
});

export const DEEPSEEK_OUTPUT_TOKEN_LIMITS: Readonly<
  Record<AuditModelTask, number>
> =
  Object.freeze({
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
  if (status === 401) return "authentication";
  if (status === 403) return "permission";
  if (status === 400 || status === 422) return "schema";
  return "application";
}

function extractOutputText(payload: Record<string, unknown>): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.output)) return null;

  for (const item of payload.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === "output_text" &&
        typeof content.text === "string" &&
        content.text.trim()
      ) {
        return content.text;
      }
    }
  }
  return null;
}

function failedResponseCategory(payload: Record<string, unknown>): never {
  const error = isRecord(payload.error) ? payload.error : {};
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (/rate.?limit|too_many_requests/.test(code)) {
    throw new TransientModelProviderError("rate_limited");
  }
  if (/timeout|deadline/.test(code)) {
    throw new TransientModelProviderError("timeout");
  }
  if (/unavailable|server|overload|insufficient_system_resource/.test(code)) {
    throw new TransientModelProviderError("unavailable");
  }
  if (/auth|api.?key/.test(code)) {
    throw new TerminalModelProviderError("authentication");
  }
  if (/permission|forbidden/.test(code)) {
    throw new TerminalModelProviderError("permission");
  }
  throw new TerminalModelProviderError("application");
}

export function parseDeepSeekResponsePayload(
  payload: unknown,
  output: "json" | "text" = "json"
): string {
  if (!isRecord(payload)) {
    throw new TerminalModelProviderError("invalid_response");
  }
  if (payload.status === "failed") failedResponseCategory(payload);
  if (payload.status === "incomplete") {
    const details = isRecord(payload.incomplete_details)
      ? payload.incomplete_details
      : {};
    if (details.reason === "content_filter") {
      throw new TerminalModelProviderError("content_safety");
    }
    throw new TerminalModelProviderError("invalid_response");
  }
  if (payload.status !== "completed") {
    throw new TerminalModelProviderError("invalid_response");
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new TerminalModelProviderError("invalid_response");
  }
  if (output === "json") {
    try {
      JSON.parse(outputText);
    } catch {
      throw new TerminalModelProviderError("invalid_response");
    }
  }
  return outputText;
}

export type DeepSeekStructuredRequest = {
  task: AuditModelTask;
  model: "deepseek-v4-flash" | "deepseek-v4-pro";
  contents: string;
  schema: unknown;
  systemInstruction: string;
  timeoutMs: number;
};

export function buildDeepSeekStructuredRequestBody(
  request: DeepSeekStructuredRequest
) {
  return {
    model: request.model,
    instructions: request.systemInstruction,
    input: request.contents,
    reasoning: {
      effort: DEEPSEEK_REASONING_EFFORT[request.task],
    },
    max_output_tokens: DEEPSEEK_OUTPUT_TOKEN_LIMITS[request.task],
    text: {
      format: {
        type: "json_schema" as const,
        name: `verdict_${request.task}`,
        schema: toDeepSeekJsonSchema(request.schema),
      },
    },
    stream: false,
    store: false,
  };
}

export async function generateDeepSeekStructuredJson(
  request: DeepSeekStructuredRequest
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new TerminalModelProviderError("authentication");
  }

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_RESPONSES_URL, {
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
      throw new TransientModelProviderError("timeout");
    }
    if (error instanceof TypeError) {
      throw new TransientModelProviderError("transport");
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new TransientModelProviderError("rate_limited");
    }
    if (response.status >= 500 && response.status <= 504) {
      throw new TransientModelProviderError("unavailable");
    }
    throw new TerminalModelProviderError(
      terminalCategoryForStatus(response.status)
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TerminalModelProviderError("invalid_response");
  }

  return parseDeepSeekResponsePayload(payload);
}
