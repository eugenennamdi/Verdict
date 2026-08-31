export const MODEL_TEMPORARILY_UNAVAILABLE_CODE =
  "MODEL_TEMPORARILY_UNAVAILABLE";

export const MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Verdict couldn't finish this investigation right now. Your audit wasn't counted. Please try again shortly.";

export const GENERIC_INVESTIGATION_ERROR_MESSAGE =
  "Verdict couldn't complete this investigation. Please try again shortly.";

const PRIVATE_AVAILABILITY_DETAIL =
  /MODEL_(?:HIGH_DEMAND|TEMPORARILY_UNAVAILABLE)|RESOURCE_EXHAUSTED|UNAVAILABLE/i;
const PRIVATE_PROVIDER_DETAIL =
  /gemini|google|deepseek|provider response|capacity pool|model ID|MODEL_PROVIDER_TERMINAL_FAILURE/i;
const AVAILABILITY_MODEL_ERROR_NAMES = new Set([
  "GeminiAvailabilityError",
  "ModelAvailabilityError",
  "ModelProviderExhaustedError",
  "AttemptLocalModelProviderError",
  "TransientModelProviderError",
]);
const MODEL_ERROR_NAMES = new Set([
  ...AVAILABILITY_MODEL_ERROR_NAMES,
  "TerminalModelProviderError",
]);
const INTERNAL_CODE = /^(?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasProviderErrorShape(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  const providerError = value.error;
  return (
    typeof providerError.message === "string" &&
    (typeof providerError.code === "number" ||
      typeof providerError.code === "string" ||
      typeof providerError.status === "string")
  );
}

function isSerializedProviderError(error: unknown, message: string): boolean {
  if (hasProviderErrorShape(error)) return true;
  if (error instanceof Error && /ApiError|GoogleGenAIError/i.test(error.name)) {
    return true;
  }
  if (!message.startsWith("{")) return false;
  try {
    return hasProviderErrorShape(JSON.parse(message));
  } catch {
    return false;
  }
}

export function isSanitizedModelAvailabilityError(error: unknown): boolean {
  if (
    error instanceof Error &&
    AVAILABILITY_MODEL_ERROR_NAMES.has(error.name)
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return PRIVATE_AVAILABILITY_DETAIL.test(message);
}

export function publicInvestigationErrorMessage(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? "")).trim();
  if (isSanitizedModelAvailabilityError(error)) {
    return MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE;
  }
  if (
    (error instanceof Error && MODEL_ERROR_NAMES.has(error.name)) ||
    PRIVATE_PROVIDER_DETAIL.test(message) ||
    isSerializedProviderError(error, message)
  ) {
    return GENERIC_INVESTIGATION_ERROR_MESSAGE;
  }
  if (!message || INTERNAL_CODE.test(message)) {
    return GENERIC_INVESTIGATION_ERROR_MESSAGE;
  }
  return message;
}
