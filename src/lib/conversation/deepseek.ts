import type { ModelToolCall } from "@/lib/conversation/actions";

export const DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_OUTPUT_TOKENS = 400;

export const START_STARTUP_AUDIT_TOOL = {
  type: "function",
  function: {
    name: "start_startup_audit",
    description:
      "Ask Verdict to start a growth audit of a public startup website. Call only when the user has provided a concrete URL. Do not call this to fetch the site yourself.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Public http(s) URL of the startup to investigate.",
        },
      },
      required: ["url"],
    },
  },
} as const;

export type ChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekCompletion = {
  content: string | null;
  toolCalls: ModelToolCall[];
};

export function buildVerdictSystemPrompt(activeReportId?: string): string {
  const reportLine = activeReportId
    ? `A report was just produced at /report/${activeReportId}. You may mention it. Do not invent scores, pillar numbers, or page evidence. For details, point the user to that report.`
    : "No audit is in progress unless the user provides a URL.";

  return `You are Verdict, an autonomous growth investigator for startups.

You inspect public startup websites and produce a Growth Readiness Score across seven pillars: Positioning (20%), Messaging (15%), Website & UX (15%), Conversion (15%), Growth Foundation (15%), Trust (10%), and Market & Competition (10%). The overall score is computed deterministically from those pillar scores.

You are confident, concise, analytical, and conversational. You are not a generic assistant.

${reportLine}

Rules:
- Never pretend an audit happened if it did not.
- Never invent website evidence, scores, or findings.
- Never fetch URLs. You cannot browse the web.
- To start an investigation, call start_startup_audit with a concrete public URL.
- If the user wants an audit but has not given a usable URL, ask for the URL. Do not call the tool.
- Keep ordinary replies to 1–3 short sentences.
- For small acknowledgements such as "alright", "hmm", "ok", or "cool", stay in the conversation naturally and invite a URL without repeating a canned specialist pitch.
- For unrelated requests, redirect politely toward startup investigation, with varied wording.
- You may discuss capabilities, methodology, pillars, and how to start an audit.
- Do not mention model names, vendors, tools, or hidden reasoning.`;
}

export async function completeConversation(
  messages: ChatTurn[],
  options?: { timeoutMs?: number }
): Promise<DeepSeekCompletion> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_UNAVAILABLE");
  }

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      tools: [START_STARTUP_AUDIT_TOOL],
      tool_choice: "auto",
      thinking: { type: "disabled" },
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: false,
    }),
    signal: AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error("DEEPSEEK_UNAVAILABLE");
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };

  const message = payload.choices?.[0]?.message;
  const toolCalls: ModelToolCall[] = (message?.tool_calls || []).map((call) => ({
    name: call.function?.name,
    arguments: call.function?.arguments,
  }));

  return {
    content: message?.content ?? null,
    toolCalls,
  };
}
