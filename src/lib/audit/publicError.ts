export const MODEL_TEMPORARILY_UNAVAILABLE_CODE =
  "MODEL_TEMPORARILY_UNAVAILABLE";

export const MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Verdict couldn't finish this investigation right now. The analysis service is temporarily busy. Your audit wasn't counted. Try again shortly.";

const PRIVATE_AVAILABILITY_DETAIL =
  /MODEL_(?:HIGH_DEMAND|TEMPORARILY_UNAVAILABLE)|RESOURCE_EXHAUSTED|UNAVAILABLE/i;
const PRIVATE_PROVIDER_DETAIL = /gemini|google|capacity pool|model ID/i;

export function isSanitizedModelAvailabilityError(error: unknown): boolean {
  if (
    error instanceof Error &&
    (error.name === "GeminiAvailabilityError" ||
      error.name === "ModelAvailabilityError")
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return PRIVATE_AVAILABILITY_DETAIL.test(message);
}

export function publicInvestigationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    isSanitizedModelAvailabilityError(error) ||
    PRIVATE_PROVIDER_DETAIL.test(message)
  ) {
    return MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE;
  }
  return message;
}
