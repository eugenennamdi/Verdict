export const MODEL_TEMPORARILY_UNAVAILABLE_CODE =
  "MODEL_TEMPORARILY_UNAVAILABLE";

export const MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Verdict couldn't finish this investigation right now. Your audit wasn't counted. Please try again shortly.";

export const GENERIC_INVESTIGATION_ERROR_MESSAGE =
  "Verdict couldn't complete this investigation. Please try again shortly.";

const PRIVATE_AVAILABILITY_DETAIL =
  /MODEL_(?:HIGH_DEMAND|TEMPORARILY_UNAVAILABLE|PROVIDER_TERMINAL_FAILURE)|RESOURCE_EXHAUSTED|UNAVAILABLE/i;
const PRIVATE_PROVIDER_DETAIL =
  /gemini|google|deepseek|provider response|capacity pool|model ID/i;
const MODEL_ERROR_NAMES = new Set([
  "GeminiAvailabilityError",
  "ModelAvailabilityError",
  "ModelProviderExhaustedError",
  "AttemptLocalModelProviderError",
  "TransientModelProviderError",
  "TerminalModelProviderError",
]);
const INTERNAL_CODE = /^(?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+$/;

export function isSanitizedModelAvailabilityError(error: unknown): boolean {
  if (
    error instanceof Error &&
    MODEL_ERROR_NAMES.has(error.name)
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return PRIVATE_AVAILABILITY_DETAIL.test(message);
}

export function publicInvestigationErrorMessage(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? "")).trim();
  if (
    isSanitizedModelAvailabilityError(error) ||
    PRIVATE_PROVIDER_DETAIL.test(message)
  ) {
    return MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE;
  }
  if (!message || INTERNAL_CODE.test(message)) {
    return GENERIC_INVESTIGATION_ERROR_MESSAGE;
  }
  return message;
}
