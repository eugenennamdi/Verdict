import {
  extractStartupUrl,
  FALLBACK_REPLY,
  normalizeCandidateUrl,
} from "@/lib/conversation/intents";
import { parseAndAssertHttpUrl } from "@/lib/security/url";

export type ConversationAction = {
  action: "respond" | "request_url" | "start_audit";
  message: string;
  url: string | null;
};

export type ModelToolCall = {
  name?: string;
  arguments?: string;
};

export { FALLBACK_REPLY };

export const ASK_URL_REPLY = "I can investigate that. What is the startup URL?";

const START_AUDIT_TOOL = "start_startup_audit";

export function obviousAuditUrl(text: string): string | null {
  return extractStartupUrl(text);
}

export function resolveModelTurn(input: {
  content?: string | null;
  toolCalls?: ModelToolCall[] | null;
}): ConversationAction {
  const tool = (input.toolCalls || []).find(
    (call) => call?.name === START_AUDIT_TOOL
  );

  if (tool) {
    return resolveStartAuditTool(tool, input.content);
  }

  const unknownTool = (input.toolCalls || []).find((call) => call?.name);
  if (unknownTool) {
    return { action: "respond", message: FALLBACK_REPLY, url: null };
  }

  const message = (input.content || "").trim();
  if (!message) {
    return { action: "respond", message: FALLBACK_REPLY, url: null };
  }

  return { action: "respond", message, url: null };
}

function resolveStartAuditTool(
  tool: ModelToolCall,
  content?: string | null
): ConversationAction {
  let rawUrl: string | null = null;
  try {
    const parsedArgs = JSON.parse(tool.arguments || "{}") as { url?: unknown };
    if (typeof parsedArgs.url === "string") {
      rawUrl = parsedArgs.url;
    }
  } catch {
    return { action: "respond", message: FALLBACK_REPLY, url: null };
  }

  if (!rawUrl || !rawUrl.trim()) {
    return {
      action: "request_url",
      message: (content || "").trim() || ASK_URL_REPLY,
      url: null,
    };
  }

  const candidate = extractStartupUrl(rawUrl) || normalizeCandidateUrl(rawUrl);
  try {
    const safe = parseAndAssertHttpUrl(candidate);
    return {
      action: "start_audit",
      message: (content || "").trim(),
      url: safe.href,
    };
  } catch {
    return {
      action: "request_url",
      message:
        "That URL doesn't look safe to inspect. Please send a public http(s) startup URL.",
      url: null,
    };
  }
}
