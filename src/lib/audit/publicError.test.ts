import { describe, expect, it } from "vitest";
import {
  MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE,
  publicInvestigationErrorMessage,
} from "./publicError";

describe("public investigation errors", () => {
  it.each([
    "MODEL_HIGH_DEMAND",
    "UNAVAILABLE",
    "RESOURCE_EXHAUSTED",
    "gemini-3.7-flash capacity pool",
  ])("hides private provider detail from users: %s", (internalMessage) => {
    const result = publicInvestigationErrorMessage(internalMessage);

    expect(result).toBe(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE);
    expect(result).not.toMatch(
      /MODEL_HIGH_DEMAND|UNAVAILABLE|RESOURCE_EXHAUSTED|gemini|google/i
    );
  });

  it("preserves unrelated application errors", () => {
    expect(publicInvestigationErrorMessage("Invalid URL")).toBe("Invalid URL");
  });
});
