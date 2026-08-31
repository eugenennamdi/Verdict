import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_FOLLOWUP_TIMEOUT_MS,
  conversationModeForRequest,
  conversationTimeoutForMode,
  GENERAL_CONVERSATION_TIMEOUT_MS,
  runPendingRequest,
} from "./workspaceRequestState";

describe("workspace request state", () => {
  it("classifies Hello as general thinking without an audit", () => {
    expect(conversationModeForRequest("Hello", false)).toBe("thinking");
  });

  it("keeps unrelated Hello in thinking mode when an audit is restored", () => {
    expect(conversationModeForRequest("Hello", true)).toBe("thinking");
  });

  it("classifies a grounded audit question as a follow-up", () => {
    expect(
      conversationModeForRequest("Why is conversion weak?", true)
    ).toBe("followup");
  });

  it("uses a short general timeout without shortening grounded Q&A", () => {
    expect(conversationTimeoutForMode("thinking")).toBe(
      GENERAL_CONVERSATION_TIMEOUT_MS
    );
    expect(conversationTimeoutForMode("followup")).toBe(
      AUDIT_FOLLOWUP_TIMEOUT_MS
    );
  });

  it("delivers a successful response and always clears pending state", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    await runPendingRequest({
      request: async () => "Hello from Verdict",
      onSuccess,
      onError,
      onSettled,
    });

    expect(onSuccess).toHaveBeenCalledWith("Hello from Verdict");
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it.each(["provider timeout", "network error"])(
    "clears pending state after %s",
    async (message) => {
      const error = new Error(message);
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onSettled = vi.fn();

      await runPendingRequest({
        request: async () => {
          throw error;
        },
        onSuccess,
        onError,
        onSettled,
      });

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error);
      expect(onSettled).toHaveBeenCalledOnce();
    }
  );
});
