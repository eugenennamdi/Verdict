import "server-only";

import { GoogleGenAI } from "@google/genai";
import { generateDeepSeekStructuredJson } from "@/lib/audit/deepseek";
import { parseAndValidateStructuredOutput } from "@/lib/audit/structuredOutput";
import {
  AttemptLocalModelProviderError,
  DEEPSEEK_FLASH_AUDIT_MODEL,
  FALLBACK_AUDIT_MODEL,
  ModelAvailabilityError,
  ModelProviderExhaustedError,
  PRIMARY_AUDIT_MODEL,
  TerminalModelProviderError,
  classifyAttemptLocalModelError,
  classifyTerminalModelError,
  createAuditGenerationConfig,
  modelAttemptTelemetry,
  type AuditModel,
  type AuditModelExecutionMetadata,
  type AuditModelObserver,
  type AuditModelProvider,
  type AuditModelTask,
  type AuditModelTier,
  type ModelAttemptLocalFailureCategory,
  type ModelAttemptTelemetry,
  type ModelAvailabilityErrorCategory,
} from "@/lib/audit/model";

type ModelAttempt = {
  provider: AuditModelProvider;
  model: AuditModel;
  tier: AuditModelTier;
  timeoutMs: number;
};

export const STRUCTURED_MODEL_POLICIES: Readonly<
  Record<AuditModelTask, readonly ModelAttempt[]>
> = {
  normalization: [
    { provider: "google", model: PRIMARY_AUDIT_MODEL, tier: "primary", timeoutMs: 8_000 },
    { provider: "deepseek", model: DEEPSEEK_FLASH_AUDIT_MODEL, tier: "secondary", timeoutMs: 8_000 },
    { provider: "google", model: FALLBACK_AUDIT_MODEL, tier: "tertiary", timeoutMs: 6_000 },
  ],
  planner: [
    { provider: "google", model: PRIMARY_AUDIT_MODEL, tier: "primary", timeoutMs: 3_000 },
    { provider: "deepseek", model: DEEPSEEK_FLASH_AUDIT_MODEL, tier: "secondary", timeoutMs: 3_000 },
    { provider: "google", model: FALLBACK_AUDIT_MODEL, tier: "tertiary", timeoutMs: 1_500 },
  ],
  grader: [
    { provider: "google", model: PRIMARY_AUDIT_MODEL, tier: "primary", timeoutMs: 35_000 },
    { provider: "deepseek", model: DEEPSEEK_FLASH_AUDIT_MODEL, tier: "secondary", timeoutMs: 25_000 },
    { provider: "google", model: FALLBACK_AUDIT_MODEL, tier: "tertiary", timeoutMs: 20_000 },
  ],
  qa: [
    { provider: "google", model: PRIMARY_AUDIT_MODEL, tier: "primary", timeoutMs: 10_000 },
    { provider: "deepseek", model: DEEPSEEK_FLASH_AUDIT_MODEL, tier: "secondary", timeoutMs: 12_000 },
    { provider: "google", model: FALLBACK_AUDIT_MODEL, tier: "tertiary", timeoutMs: 8_000 },
  ],
};

export const STRUCTURED_MODEL_OPERATION_TIMEOUTS: Readonly<
  Record<AuditModelTask, number>
> =
  Object.freeze({
    normalization: 23_000,
    planner: 8_000,
    grader: 80_000,
    qa: 31_000,
  });

export const MIN_MODEL_ATTEMPT_WINDOWS_MS: Readonly<
  Record<AuditModelTask, number>
> = Object.freeze({
  normalization: 1_000,
  planner: 500,
  grader: 5_000,
  qa: 1_000,
});

export type StructuredModelGenerationRequest = {
  task: AuditModelTask;
  provider: AuditModelProvider;
  model: AuditModel;
  contents: string;
  schema: unknown;
  systemInstruction: string;
  timeoutMs: number;
};

export type StructuredModelGeneratedValue = {
  text: string;
  telemetry?: ModelAttemptTelemetry;
};

export type StructuredModelGenerator = (
  request: StructuredModelGenerationRequest
) => Promise<string | StructuredModelGeneratedValue>;

export type ModelAttemptLog = {
  task: AuditModelTask;
  provider: AuditModelProvider;
  model: AuditModel;
  tier: AuditModelTier;
  durationMs: number;
  result: "success" | "failure";
  classification: "success" | "transient" | "attempt_local" | "terminal";
  safeCategory: string;
  httpStatus?: number;
  finishReason?: ModelAttemptTelemetry["finishReason"];
};

let googleClient: GoogleGenAI | undefined;

function getGoogleClient(): GoogleGenAI {
  googleClient ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
  });
  return googleClient;
}

async function defaultGenerator(
  request: StructuredModelGenerationRequest
): Promise<string | StructuredModelGeneratedValue> {
  if (request.provider === "deepseek") {
    if (request.model !== DEEPSEEK_FLASH_AUDIT_MODEL) {
      throw new TerminalModelProviderError("application");
    }
    return generateDeepSeekStructuredJson({
      task: request.task,
      model: request.model,
      contents: request.contents,
      schema: request.schema,
      systemInstruction: request.systemInstruction,
      timeoutMs: request.timeoutMs,
    });
  }

  if (
    request.model !== PRIMARY_AUDIT_MODEL &&
    request.model !== FALLBACK_AUDIT_MODEL
  ) {
    throw new TerminalModelProviderError("application");
  }
  const response = await getGoogleClient().models.generateContent({
    model: request.model,
    contents: request.contents,
    config: createAuditGenerationConfig(
      request.task,
      request.schema,
      request.systemInstruction
    ),
  });
  if (!response.text) {
    throw new AttemptLocalModelProviderError("missing_output");
  }
  return { text: response.text };
}

function withAttemptTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("MODEL_ATTEMPT_TIMEOUT")),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function recordAttempt(record: ModelAttemptLog) {
  console.info(`[ModelAttempt] ${JSON.stringify(record)}`);
}

function isAvailabilityCategory(
  category: ModelAttemptLocalFailureCategory
): category is ModelAvailabilityErrorCategory {
  return [
    "high_demand",
    "unavailable",
    "rate_limited",
    "timeout",
    "transport",
  ].includes(category);
}

function isTransientAttemptCategory(
  category: ModelAttemptLocalFailureCategory
): boolean {
  return (
    isAvailabilityCategory(category) ||
    category === "provider_unavailable" ||
    category === "provider_timeout"
  );
}

function provenanceAvailabilityCategory(
  category: ModelAttemptLocalFailureCategory
): ModelAvailabilityErrorCategory | undefined {
  if (isAvailabilityCategory(category)) return category;
  if (category === "provider_unavailable") return "unavailable";
  if (category === "provider_timeout") return "timeout";
  return undefined;
}

function mergeAttemptTelemetry(
  error: unknown,
  telemetry: ModelAttemptTelemetry
): unknown {
  if (error instanceof AttemptLocalModelProviderError) {
    return new AttemptLocalModelProviderError(error.category, {
      ...telemetry,
      ...error.telemetry,
    });
  }
  return error;
}

function safeLogTelemetry(telemetry: ModelAttemptTelemetry) {
  return {
    ...(telemetry.httpStatus === undefined
      ? {}
      : { httpStatus: telemetry.httpStatus }),
    ...(telemetry.finishReason === undefined
      ? {}
      : { finishReason: telemetry.finishReason }),
  };
}

export async function runStructuredModelTask(input: {
  task: AuditModelTask;
  contents: string;
  schema: unknown;
  systemInstruction: string;
  deadlineAt?: number;
  onResult?: AuditModelObserver;
  generate?: StructuredModelGenerator;
  onAttempt?: (record: ModelAttemptLog) => void;
}): Promise<{ value: string; metadata: AuditModelExecutionMetadata }> {
  const startedAt = Date.now();
  const taskDeadline = startedAt + STRUCTURED_MODEL_OPERATION_TIMEOUTS[input.task];
  const deadlineAt = Math.min(input.deadlineAt ?? taskDeadline, taskDeadline);
  const generate = input.generate ?? defaultGenerator;
  const minimumAttemptWindowMs = MIN_MODEL_ATTEMPT_WINDOWS_MS[input.task];
  let lastAvailabilityCategory: ModelAvailabilityErrorCategory | undefined;
  let lastAttemptLocalCategory: ModelAttemptLocalFailureCategory | undefined;

  for (const attempt of STRUCTURED_MODEL_POLICIES[input.task]) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < minimumAttemptWindowMs) {
      throw new ModelAvailabilityError(
        lastAvailabilityCategory ?? "timeout"
      );
    }

    const attemptStartedAt = Date.now();
    const timeoutMs = Math.max(
      minimumAttemptWindowMs,
      Math.min(attempt.timeoutMs, remainingMs)
    );

    try {
      const generated = await withAttemptTimeout(
        generate({
          task: input.task,
          provider: attempt.provider,
          model: attempt.model,
          contents: input.contents,
          schema: input.schema,
          systemInstruction: input.systemInstruction,
          timeoutMs,
        }),
        timeoutMs
      );
      const generatedValue =
        typeof generated === "string" ? { text: generated } : generated;
      try {
        parseAndValidateStructuredOutput({
          task: input.task,
          text: generatedValue.text,
          schema: input.schema,
        });
      } catch (error) {
        throw mergeAttemptTelemetry(error, generatedValue.telemetry ?? {});
      }
      const value = generatedValue.text;
      const log: ModelAttemptLog = {
        task: input.task,
        provider: attempt.provider,
        model: attempt.model,
        tier: attempt.tier,
        durationMs: Date.now() - attemptStartedAt,
        result: "success",
        classification: "success",
        safeCategory: "none",
        ...safeLogTelemetry(generatedValue.telemetry ?? {}),
      };
      recordAttempt(log);
      input.onAttempt?.(log);

      const metadata: AuditModelExecutionMetadata = {
        requestedPrimaryModel: PRIMARY_AUDIT_MODEL,
        provider: attempt.provider,
        model: attempt.model,
        modelUsed: attempt.model,
        tier: attempt.tier,
        fallbackUsed: attempt.tier !== "primary",
        ...(lastAvailabilityCategory
          ? { availabilityErrorCategory: lastAvailabilityCategory }
          : {}),
      };
      input.onResult?.(input.task, metadata);
      return { value, metadata };
    } catch (error) {
      const attemptLocalCategory = classifyAttemptLocalModelError(error);
      if (attemptLocalCategory) {
        lastAttemptLocalCategory = attemptLocalCategory;
        lastAvailabilityCategory =
          provenanceAvailabilityCategory(attemptLocalCategory) ??
          lastAvailabilityCategory;
        const telemetry = modelAttemptTelemetry(error);
        const log: ModelAttemptLog = {
          task: input.task,
          provider: attempt.provider,
          model: attempt.model,
          tier: attempt.tier,
          durationMs: Date.now() - attemptStartedAt,
          result: "failure",
          classification: isTransientAttemptCategory(attemptLocalCategory)
            ? "transient"
            : "attempt_local",
          safeCategory: attemptLocalCategory,
          ...safeLogTelemetry(telemetry),
        };
        recordAttempt(log);
        input.onAttempt?.(log);
        continue;
      }

      const log: ModelAttemptLog = {
        task: input.task,
        provider: attempt.provider,
        model: attempt.model,
        tier: attempt.tier,
        durationMs: Date.now() - attemptStartedAt,
        result: "failure",
        classification: "terminal",
        safeCategory: classifyTerminalModelError(error),
        ...safeLogTelemetry(modelAttemptTelemetry(error)),
      };
      recordAttempt(log);
      input.onAttempt?.(log);
      throw error;
    }
  }

  if (lastAttemptLocalCategory) {
    if (isAvailabilityCategory(lastAttemptLocalCategory)) {
      throw new ModelAvailabilityError(lastAttemptLocalCategory);
    }
    throw new ModelProviderExhaustedError(lastAttemptLocalCategory);
  }
  throw new ModelAvailabilityError(lastAvailabilityCategory ?? "unavailable");
}
