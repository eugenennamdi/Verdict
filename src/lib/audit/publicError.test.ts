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
    "MODEL_PROVIDER_TERMINAL_FAILURE",
    "deepseek-v4-flash invalid_response",
    "gemini-3.7-flash capacity pool",
  ])("hides private provider detail from users: %s", (internalMessage) => {
    const result = publicInvestigationErrorMessage(internalMessage);

    expect(result).toBe(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE);
    expect(result).not.toMatch(
      /MODEL_HIGH_DEMAND|UNAVAILABLE|RESOURCE_EXHAUSTED|gemini|google/i
    );
  });

  it("exhaustively sanitizes model-provider error classes", () => {
    for (const error of [
      new ModelProviderExhaustedError("malformed_json"),
      new TerminalModelProviderError("invalid_request"),
    ]) {
      expect(publicInvestigationErrorMessage(error)).toBe(
        MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE
      );
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
