import { ThinkingLevel } from "@google/genai";

export const PRIMARY_AUDIT_MODEL = "gemini-3.7-flash";
export const FALLBACK_AUDIT_MODEL = "gemini-3.6-flash";

/** Backwards-compatible canonical model alias. */
export const AUDIT_MODEL = PRIMARY_AUDIT_MODEL;

export type AuditModel =
  | typeof PRIMARY_AUDIT_MODEL
  | typeof FALLBACK_AUDIT_MODEL;

export type GeminiAvailabilityErrorCategory =
  | "high_demand"
  | "unavailable"
  | "rate_limited"
  | "timeout";

export type AuditModelExecutionMetadata = {
  requestedPrimaryModel: typeof PRIMARY_AUDIT_MODEL;
  modelUsed: AuditModel;
  fallbackUsed: boolean;
  availabilityErrorCategory?: GeminiAvailabilityErrorCategory;
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

export class GeminiAvailabilityError extends Error {
  readonly category: GeminiAvailabilityErrorCategory;

  constructor(category: GeminiAvailabilityErrorCategory) {
    super("MODEL_HIGH_DEMAND");
    this.name = "GeminiAvailabilityError";
    this.category = category;
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

export function classifyTransientGeminiAvailabilityError(
  error: unknown
): GeminiAvailabilityErrorCategory | null {
  if (error instanceof GeminiAvailabilityError) return error.category;

  const status = numericStatus(error);
  if (status === 503) return "unavailable";
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
  if (/^(?:TIMEOUT_ERROR|AUDIT_QA_TIMEOUT)$/i.test(message)) return "timeout";
  if (/^UNAVAILABLE$/i.test(message) || /\b503\b.*\bUNAVAILABLE\b|\bUNAVAILABLE\b.*\b503\b/i.test(message)) {
    return "unavailable";
  }
  if (/\b429\b.*(?:RESOURCE_EXHAUSTED|rate limit|too many requests)/i.test(message)) {
    return "rate_limited";
  }
  return null;
}

export function isTransientGeminiAvailabilityError(error: unknown): boolean {
  return classifyTransientGeminiAvailabilityError(error) !== null;
}

export async function runAuditModelWithAvailabilityFailover<T>(input: {
  task: AuditModelTask;
  generate: (model: AuditModel) => Promise<T>;
  onResult?: AuditModelObserver;
  canAttempt?: () => boolean;
}): Promise<{ value: T; metadata: AuditModelExecutionMetadata }> {
  let availabilityErrorCategory: GeminiAvailabilityErrorCategory | undefined;

  for (let primaryAttempt = 0; primaryAttempt < 2; primaryAttempt++) {
    try {
      const value = await input.generate(PRIMARY_AUDIT_MODEL);
      const metadata: AuditModelExecutionMetadata = {
        requestedPrimaryModel: PRIMARY_AUDIT_MODEL,
        modelUsed: PRIMARY_AUDIT_MODEL,
        fallbackUsed: false,
        ...(availabilityErrorCategory ? { availabilityErrorCategory } : {}),
      };
      input.onResult?.(input.task, metadata);
      return { value, metadata };
    } catch (error) {
      const category = classifyTransientGeminiAvailabilityError(error);
      if (!category) throw error;
      availabilityErrorCategory = category;
      if (primaryAttempt === 0) {
        if (input.canAttempt?.() === false) {
          throw new GeminiAvailabilityError(category);
        }
        console.warn("[Gemini] Primary audit model unavailable; retrying once", {
          task: input.task,
          model: PRIMARY_AUDIT_MODEL,
          category,
        });
      }
    }
  }

  if (input.canAttempt?.() === false) {
    throw new GeminiAvailabilityError(
      availabilityErrorCategory ?? "unavailable"
    );
  }

  console.warn("[Gemini] Primary retry unavailable; using availability fallback", {
    task: input.task,
    primaryModel: PRIMARY_AUDIT_MODEL,
    fallbackModel: FALLBACK_AUDIT_MODEL,
    category: availabilityErrorCategory,
  });

  try {
    const value = await input.generate(FALLBACK_AUDIT_MODEL);
    const metadata: AuditModelExecutionMetadata = {
      requestedPrimaryModel: PRIMARY_AUDIT_MODEL,
      modelUsed: FALLBACK_AUDIT_MODEL,
      fallbackUsed: true,
      ...(availabilityErrorCategory ? { availabilityErrorCategory } : {}),
    };
    input.onResult?.(input.task, metadata);
    return { value, metadata };
  } catch (error) {
    const category = classifyTransientGeminiAvailabilityError(error);
    if (!category) throw error;
    throw new GeminiAvailabilityError(category);
  }
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
