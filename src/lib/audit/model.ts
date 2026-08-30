import { ThinkingLevel } from "@google/genai";
import { MODEL_TEMPORARILY_UNAVAILABLE_CODE } from "@/lib/audit/publicError";

export const PRIMARY_AUDIT_MODEL = "gemini-3.7-flash";
export const FALLBACK_AUDIT_MODEL = "gemini-3.6-flash";
export const DEEPSEEK_FLASH_AUDIT_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_PRO_AUDIT_MODEL = "deepseek-v4-pro";

/** Backwards-compatible canonical model alias. */
export const AUDIT_MODEL = PRIMARY_AUDIT_MODEL;

export type AuditModel =
  | typeof PRIMARY_AUDIT_MODEL
  | typeof FALLBACK_AUDIT_MODEL
  | typeof DEEPSEEK_FLASH_AUDIT_MODEL
  | typeof DEEPSEEK_PRO_AUDIT_MODEL;

export type AuditModelProvider = "google" | "deepseek";
export type AuditModelTier = "primary" | "secondary" | "tertiary";

export type ModelAvailabilityErrorCategory =
  | "high_demand"
  | "unavailable"
  | "rate_limited"
  | "timeout"
  | "transport";

/** Backwards-compatible type name for existing route and test consumers. */
export type GeminiAvailabilityErrorCategory = ModelAvailabilityErrorCategory;

export type AuditModelExecutionMetadata = {
  requestedPrimaryModel: typeof PRIMARY_AUDIT_MODEL;
  provider: AuditModelProvider;
  model: AuditModel;
  modelUsed: AuditModel;
  tier: AuditModelTier;
  fallbackUsed: boolean;
  availabilityErrorCategory?: ModelAvailabilityErrorCategory;
};

export const AUDIT_THINKING_LEVELS = Object.freeze({
  normalization: ThinkingLevel.LOW,
  planner: ThinkingLevel.LOW,
  grader: ThinkingLevel.MEDIUM,
  qa: ThinkingLevel.MEDIUM,
});

export type AuditModelTask = keyof typeof AUDIT_THINKING_LEVELS;

export type AuditModelObserver = (
  task: AuditModelTask,
  metadata: AuditModelExecutionMetadata
) => void;

export type AuditRunModelProvenance = {
  normalization?: AuditModelExecutionMetadata;
  planner: AuditModelExecutionMetadata[];
  grader?: AuditModelExecutionMetadata;
};

export class ModelAvailabilityError extends Error {
  readonly category: ModelAvailabilityErrorCategory;

  constructor(category: ModelAvailabilityErrorCategory) {
    super(MODEL_TEMPORARILY_UNAVAILABLE_CODE);
    this.name = "ModelAvailabilityError";
    this.category = category;
  }
}

/** Retained for callers/tests that construct the former Google-only error. */
export class GeminiAvailabilityError extends ModelAvailabilityError {
  constructor(category: ModelAvailabilityErrorCategory) {
    super(category);
    this.name = "GeminiAvailabilityError";
  }
}

export class TransientModelProviderError extends Error {
  readonly category: ModelAvailabilityErrorCategory;

  constructor(category: ModelAvailabilityErrorCategory) {
    super(MODEL_TEMPORARILY_UNAVAILABLE_CODE);
    this.name = "TransientModelProviderError";
    this.category = category;
  }
}

export class TerminalModelProviderError extends Error {
  readonly safeCategory:
    | "authentication"
    | "permission"
    | "schema"
    | "content_safety"
    | "invalid_response"
    | "application";

  constructor(
    safeCategory: TerminalModelProviderError["safeCategory"],
    message = "MODEL_PROVIDER_TERMINAL_FAILURE"
  ) {
    super(message);
    this.name = "TerminalModelProviderError";
    this.safeCategory = safeCategory;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorRecords(error: unknown): Record<string, unknown>[] {
  if (!isRecord(error)) return [];
  return [error, error.error, error.response].filter(isRecord);
}

function numericStatus(error: unknown): number | undefined {
  for (const record of errorRecords(error)) {
    for (const key of ["status", "statusCode", "code"] as const) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && /^\d{3}$/.test(value)) {
        return Number(value);
      }
    }
  }
  return undefined;
}

function symbolicStatus(error: unknown): string[] {
  const statuses: string[] = [];
  for (const record of errorRecords(error)) {
    for (const key of ["status", "statusText", "code"] as const) {
      const value = record[key];
      if (typeof value === "string") statuses.push(value.toUpperCase());
    }
  }
  return statuses;
}

export function classifyTransientModelError(
  error: unknown
): ModelAvailabilityErrorCategory | null {
  if (
    error instanceof ModelAvailabilityError ||
    error instanceof TransientModelProviderError
  ) {
    return error.category;
  }

  const status = numericStatus(error);
  if (status !== undefined && status >= 500 && status <= 504) {
    return "unavailable";
  }
  if (status === 429) return "rate_limited";

  const symbolic = symbolicStatus(error);
  if (symbolic.includes("UNAVAILABLE")) return "unavailable";
  if (
    symbolic.includes("RESOURCE_EXHAUSTED") ||
    symbolic.includes("TOO_MANY_REQUESTS")
  ) {
    return "rate_limited";
  }

  const message = error instanceof Error ? error.message.trim() : "";
  if (/MODEL_HIGH_DEMAND|high demand/i.test(message)) return "high_demand";
  if (
    /^(?:TIMEOUT_ERROR|AUDIT_QA_TIMEOUT|MODEL_ATTEMPT_TIMEOUT)$/i.test(
      message
    ) ||
    /(?:AbortError|TimeoutError)/i.test(
      error instanceof Error ? error.name : ""
    )
  ) {
    return "timeout";
  }
  if (
    /^(?:UNAVAILABLE)$/i.test(message) ||
    /\b503\b.*\bUNAVAILABLE\b|\bUNAVAILABLE\b.*\b503\b/i.test(message)
  ) {
    return "unavailable";
  }
  if (
    /\b429\b.*(?:RESOURCE_EXHAUSTED|rate limit|too many requests)/i.test(
      message
    )
  ) {
    return "rate_limited";
  }
  if (
    /^(?:fetch failed|network error|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN)$/i.test(
      message
    )
  ) {
    return "transport";
  }
  return null;
}

export function classifyTransientGeminiAvailabilityError(
  error: unknown
): GeminiAvailabilityErrorCategory | null {
  return classifyTransientModelError(error);
}

export function isTransientGeminiAvailabilityError(error: unknown): boolean {
  return classifyTransientModelError(error) !== null;
}

export function classifyTerminalModelError(
  error: unknown
): TerminalModelProviderError["safeCategory"] {
  if (error instanceof TerminalModelProviderError) return error.safeCategory;
  const status = numericStatus(error);
  if (status === 401) return "authentication";
  if (status === 403) return "permission";
  if (status === 400 || status === 422) return "schema";
  const message = error instanceof Error ? error.message : "";
  if (/safety|content.?filter|blocked content/i.test(message)) {
    return "content_safety";
  }
  return "application";
}

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
