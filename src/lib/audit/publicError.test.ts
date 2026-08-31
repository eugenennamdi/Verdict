import { describe, expect, it } from "vitest";
import {
  GENERIC_INVESTIGATION_ERROR_MESSAGE,
  MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE,
  publicInvestigationErrorMessage,
} from "./publicError";
import {
  ModelProviderExhaustedError,
  TerminalModelProviderError,
} from "./model";

describe("public investigation errors", () => {
  it.each([
    "MODEL_HIGH_DEMAND",
    "UNAVAILABLE",
    "RESOURCE_EXHAUSTED",
  ])("hides private provider detail from users: %s", (internalMessage) => {
    const result = publicInvestigationErrorMessage(internalMessage);

    expect(result).toBe(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE);
    expect(result).not.toMatch(
      /MODEL_HIGH_DEMAND|UNAVAILABLE|RESOURCE_EXHAUSTED|gemini|google/i
    );
  });

  it.each([
    "deepseek-v4-flash invalid_response",
    "gemini-3.7-flash capacity pool",
  ])("maps untyped private provider detail to generic copy: %s", (internalMessage) => {
    const result = publicInvestigationErrorMessage(internalMessage);

    expect(result).toBe(GENERIC_INVESTIGATION_ERROR_MESSAGE);
    expect(result).not.toMatch(/deepseek|gemini|invalid_response|capacity pool/i);
  });

  it("distinguishes exhausted providers from terminal application defects", () => {
    expect(
      publicInvestigationErrorMessage(
        new ModelProviderExhaustedError("malformed_json")
      )
    ).toBe(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE);
    expect(
      publicInvestigationErrorMessage(
        new TerminalModelProviderError("application")
      )
    ).toBe(GENERIC_INVESTIGATION_ERROR_MESSAGE);
  });

  it("never exposes serialized or object-shaped provider errors", () => {
    const payload = {
      error: {
        code: 400,
        message:
          "Manually set deadline 8s is too short. Minimum allowed deadline is 10s.",
        status: "INVALID_ARGUMENT",
      },
    };
    for (const error of [
      JSON.stringify(payload),
      payload,
      Object.assign(new Error(JSON.stringify(payload)), { name: "ApiError" }),
    ]) {
      const result = publicInvestigationErrorMessage(error);
      expect(result).toBe(GENERIC_INVESTIGATION_ERROR_MESSAGE);
      expect(result).not.toMatch(/deadline|INVALID_ARGUMENT|400|10s/i);
    }
  });

  it("maps unknown internal-looking codes to generic copy", () => {
    expect(publicInvestigationErrorMessage("SOME_INTERNAL_FAILURE_CODE")).toBe(
      GENERIC_INVESTIGATION_ERROR_MESSAGE
    );
  });

  it("preserves unrelated application errors", () => {
    expect(publicInvestigationErrorMessage("Invalid URL")).toBe("Invalid URL");
  });
});
