import { describe, expect, it } from "vitest";
import { obviousAuditUrl } from "./actions";
import { FALLBACK_REPLY, resolveModelTurn } from "./actions";

describe("obviousAuditUrl", () => {
  it("starts an audit from an obvious URL without DeepSeek", () => {
    expect(obviousAuditUrl("https://linear.app")).toBe("https://linear.app/");
    expect(obviousAuditUrl("linear.app")).toBe("https://linear.app/");
    expect(obviousAuditUrl("can you audit https://linear.app")).toBe(
      "https://linear.app/"
    );
  });

  it("does not treat conversational acknowledgements as audits", () => {
    expect(obviousAuditUrl("alright")).toBeNull();
    expect(obviousAuditUrl("hmm")).toBeNull();
    expect(obviousAuditUrl("could you look at my startup?")).toBeNull();
  });
});

describe("resolveModelTurn", () => {
  it("renders a normal conversational response", () => {
    expect(
      resolveModelTurn({
        content: "Whenever you're ready. Send a startup URL and I'll take a look.",
      })
    ).toEqual({
      action: "respond",
      message: "Whenever you're ready. Send a startup URL and I'll take a look.",
      url: null,
    });
  });

  it("requires URL validation before start_audit", () => {
    expect(
      resolveModelTurn({
        toolCalls: [
          {
            name: "start_startup_audit",
            arguments: JSON.stringify({ url: "https://linear.app" }),
          },
        ],
      })
    ).toEqual({
      action: "start_audit",
      message: "",
      url: "https://linear.app/",
    });

    expect(
      resolveModelTurn({
        toolCalls: [
          {
            name: "start_startup_audit",
            arguments: JSON.stringify({ url: "http://127.0.0.1" }),
          },
        ],
      }).action
    ).toBe("request_url");
  });

  it("asks for a URL when the tool is called without one", () => {
    const result = resolveModelTurn({
      content: "Sure — what should I inspect?",
      toolCalls: [
        { name: "start_startup_audit", arguments: JSON.stringify({ url: "" }) },
      ],
    });
    expect(result.action).toBe("request_url");
    expect(result.url).toBeNull();
  });

  it("falls back cleanly on empty model output", () => {
    expect(resolveModelTurn({ content: "   ", toolCalls: [] })).toEqual({
      action: "respond",
      message: FALLBACK_REPLY,
      url: null,
    });
  });

  it("does not execute malformed or unknown model output", () => {
    expect(
      resolveModelTurn({
        toolCalls: [{ name: "start_startup_audit", arguments: "{not json" }],
      })
    ).toEqual({
      action: "respond",
      message: FALLBACK_REPLY,
      url: null,
    });

    expect(
      resolveModelTurn({
        toolCalls: [
          {
            name: "fetch_website",
            arguments: JSON.stringify({ url: "https://evil.example" }),
          },
        ],
      }).action
    ).toBe("respond");

    expect(
      resolveModelTurn({
        toolCalls: [
          {
            name: "start_startup_audit",
            arguments: JSON.stringify({ url: "javascript:alert(1)" }),
          },
        ],
      }).action
    ).toBe("request_url");
  });
});
