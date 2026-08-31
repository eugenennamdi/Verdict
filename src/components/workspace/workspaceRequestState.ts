import { classifyAuditFollowup } from "@/lib/conversation/auditQuestions";

export type ConversationRequestMode = "thinking" | "followup";

export const GENERAL_CONVERSATION_TIMEOUT_MS = 15_000;
export const AUDIT_FOLLOWUP_TIMEOUT_MS = 25_000;

export function conversationModeForRequest(
  text: string,
  hasActiveReport: boolean
): ConversationRequestMode {
  const route = classifyAuditFollowup(text, hasActiveReport);
  return route.type === "general" || route.type === "missing_context"
    ? "thinking"
    : "followup";
}

export function conversationTimeoutForMode(
  mode: ConversationRequestMode
): number {
  return mode === "followup"
    ? AUDIT_FOLLOWUP_TIMEOUT_MS
    : GENERAL_CONVERSATION_TIMEOUT_MS;
}

export async function runPendingRequest<T>(input: {
  request: () => Promise<T>;
  onSuccess: (value: T) => void | Promise<void>;
  onError: (error: unknown) => void | Promise<void>;
  onSettled: () => void;
}): Promise<void> {
  try {
    await input.onSuccess(await input.request());
  } catch (error) {
    await input.onError(error);
  } finally {
    input.onSettled();
  }
}
