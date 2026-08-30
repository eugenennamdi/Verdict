import { describe, expect, it } from "vitest";
import { classifyIntent, extractStartupUrl, rateLimitReply } from "./intents";

describe("extractStartupUrl", () => {
  it("accepts bare domains and full URLs", () => {
    expect(extractStartupUrl("linear.app")).toBe("https://linear.app/");
    expect(extractStartupUrl("https://linear.app")).toBe("https://linear.app/");
    expect(extractStartupUrl("audit linear.app")).toBe("https://linear.app/");
    expect(extractStartupUrl("can you audit https://linear.app")).toBe(
      "https://linear.app/"
    );
  });

  it("returns null when no URL is present", () => {
    expect(extractStartupUrl("hello")).toBeNull();
    expect(extractStartupUrl("audit my startup")).toBeNull();
  });
});

describe("classifyIntent", () => {
  it("classifies greetings without treating them as audits", () => {
    expect(classifyIntent("hello").type).toBe("greeting");
    expect(classifyIntent("hi").type).toBe("greeting");
    expect(classifyIntent("hey").type).toBe("greeting");
  });

  it("classifies capability and scoring questions", () => {
    expect(classifyIntent("what can you do?").type).toBe("capabilities");
    expect(classifyIntent("how does scoring work?").type).toBe("scoring");
    expect(classifyIntent("what are the pillars?").type).toBe("scoring");
  });

  it("classifies audit intent with and without a URL", () => {
    expect(classifyIntent("https://linear.app")).toEqual({
      type: "audit",
      url: "https://linear.app/",
    });
    expect(classifyIntent("audit my startup").type).toBe("audit_missing_url");
  });

  it("recognizes free-form follow-ups after a completed audit", () => {
    expect(classifyIntent("why was conversion 68?", { hasCompletedAudit: true }).type).toBe(
      "audit_followup"
    );
    expect(classifyIntent("https://stripe.com", { hasCompletedAudit: true }).type).toBe(
      "audit"
    );
  });

  it("redirects unknown general-purpose queries", () => {
    expect(classifyIntent("write me a poem").type).toBe("unknown");
  });
});

describe("rateLimitReply", () => {
  it("includes remaining hours when TTL is known", () => {
    expect(rateLimitReply(7200)).toContain("2 hour");
  });
});
