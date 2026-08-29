import { ThinkingLevel } from "@google/genai";

export const AUDIT_MODEL = "gemini-3.7-flash";

export const AUDIT_THINKING_LEVELS = Object.freeze({
  normalization: ThinkingLevel.LOW,
  planner: ThinkingLevel.LOW,
  grader: ThinkingLevel.MEDIUM,
});

export type AuditModelTask = keyof typeof AUDIT_THINKING_LEVELS;

export function createAuditGenerationConfig(
  task: AuditModelTask,
  responseSchema: unknown,
  systemInstruction: string
) {
  return {
    systemInstruction,
    thinkingConfig: {
      thinkingLevel: AUDIT_THINKING_LEVELS[task],
    },
    responseMimeType: "application/json" as const,
    responseSchema,
  };
}
