import "server-only";

import { GoogleGenAI } from "@google/genai";
import { generateDeepSeekStructuredJson } from "@/lib/audit/deepseek";
import {
  DEEPSEEK_FLASH_AUDIT_MODEL,
  DEEPSEEK_PRO_AUDIT_MODEL,
  FALLBACK_AUDIT_MODEL,
  ModelAvailabilityError,
  PRIMARY_AUDIT_MODEL,
  TerminalModelProviderError,
  classifyTerminalModelError,
  classifyTransientModelError,
  createAuditGenerationConfig,
  type AuditModel,
  type AuditModelExecutionMetadata,
  type AuditModelObserver,
  type AuditModelProvider,
  type AuditModelTask,
  type AuditModelTier,
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
    { provider: "google", model: PRIMARY_AUDIT_MODEL, tier: "primary", timeoutMs: 18_000 },
    { provider: "deepseek", model: DEEPSEEK_FLASH_AUDIT_MODEL, tier: "secondary", timeoutMs: 25_000 },
    { provider: "google", model: FALLBACK_AUDIT_MODEL, tier: "tertiary", timeoutMs: 10_000 },
  ],
  qa: [
    { provider: "google", model: PRIMARY_AUDIT_MODEL, tier: "primary", timeoutMs: 10_000 },
    { provider: "deepseek", model: DEEPSEEK_FLASH_AUDIT_MODEL, tier: "secondary", timeoutMs: 12_000 },
    { provider: "google", model: FALLBACK_AUDIT_MODEL, tier: "tertiary", timeoutMs: 8_000 },
  ],
};

const OPERATION_TIMEOUTS: Readonly<Record<AuditModelTask, number>> =
  Object.freeze({
    normalization: 23_000,
    planner: 8_000,
    grader: 55_000,
    qa: 31_000,
  });

const MIN_ATTEMPT_WINDOW_MS = 500;

export type StructuredModelGenerationRequest = {
  task: AuditModelTask;
  provider: AuditModelProvider;
  model: AuditModel;
  contents: string;
  schema: unknown;
  systemInstruction: string;
  timeoutMs: number;
};

export type StructuredModelGenerator = (
  request: StructuredModelGenerationRequest
) => Promise<string>;

export type ModelAttemptLog = {
  task: AuditModelTask;
  provider: AuditModelProvider;
  model: AuditModel;
  tier: AuditModelTier;
  durationMs: number;
  result: "success" | "transient_failure" | "terminal_failure";
  safeCategory: string;
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
): Promise<string> {
  if (request.provider === "deepseek") {
    if (
      request.model !== DEEPSEEK_FLASH_AUDIT_MODEL &&
      request.model !== DEEPSEEK_PRO_AUDIT_MODEL
    ) {
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
    throw new TerminalModelProviderError("invalid_response");
  }
  return response.text;
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
  const taskDeadline = startedAt + OPERATION_TIMEOUTS[input.task];
  const deadlineAt = Math.min(input.deadlineAt ?? taskDeadline, taskDeadline);
  const generate = input.generate ?? defaultGenerator;
  let lastAvailabilityCategory: ModelAvailabilityErrorCategory | undefined;

  for (const attempt of STRUCTURED_MODEL_POLICIES[input.task]) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < MIN_ATTEMPT_WINDOW_MS) {
      throw new ModelAvailabilityError(
        lastAvailabilityCategory ?? "timeout"
      );
    }

    const attemptStartedAt = Date.now();
    const timeoutMs = Math.max(
      MIN_ATTEMPT_WINDOW_MS,
      Math.min(attempt.timeoutMs, remainingMs)
    );

    try {
      const value = await withAttemptTimeout(
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
      const log: ModelAttemptLog = {
        task: input.task,
        provider: attempt.provider,
        model: attempt.model,
        tier: attempt.tier,
        durationMs: Date.now() - attemptStartedAt,
        result: "success",
        safeCategory: "none",
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
      const transientCategory = classifyTransientModelError(error);
      if (transientCategory) {
        lastAvailabilityCategory = transientCategory;
        const log: ModelAttemptLog = {
          task: input.task,
          provider: attempt.provider,
          model: attempt.model,
          tier: attempt.tier,
          durationMs: Date.now() - attemptStartedAt,
          result: "transient_failure",
          safeCategory: transientCategory,
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
        result: "terminal_failure",
        safeCategory: classifyTerminalModelError(error),
      };
      recordAttempt(log);
      input.onAttempt?.(log);
      throw error;
    }
  }

  throw new ModelAvailabilityError(lastAvailabilityCategory ?? "unavailable");
}
