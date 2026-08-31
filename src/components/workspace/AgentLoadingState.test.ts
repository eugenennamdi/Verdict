import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentLoadingState } from "./AgentLoadingState";

describe("AgentLoadingState semantic loading presentation", () => {
  it("renders Thinking label for general conversation mode", () => {
    const html = renderToStaticMarkup(
      createElement(AgentLoadingState, {
        mode: "thinking",
      })
    );

    expect(html).toContain("Thinking");
    expect(html).not.toContain("Reviewing audit evidence");
    expect(html).not.toContain("Investigating");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("renders Reviewing audit evidence for followup mode without elapsed timer", () => {
    const html = renderToStaticMarkup(
      createElement(AgentLoadingState, {
        mode: "followup",
        startTime: Date.now() - 400_000, // 6m 40s ago
      })
    );

    expect(html).toContain("Reviewing audit evidence");
    expect(html).not.toContain("Thinking");
    expect(html).not.toContain("tabular-nums");
  });

  it("renders Investigating with domain and elapsed timer for audit mode", () => {
    const html = renderToStaticMarkup(
      createElement(AgentLoadingState, {
        mode: "audit",
        domain: "resend.com",
        startTime: Date.now() - 5000,
      })
    );

    expect(html).toContain("Investigating resend.com");
    expect(html).not.toContain("Thinking");
    expect(html).toContain("tabular-nums");
  });

  it("renders Beautiful UI 3x3 pixel grid loader without orange spinners", () => {
    const html = renderToStaticMarkup(
      createElement(AgentLoadingState, {
        mode: "thinking",
      })
    );

    expect(html).toContain("grid-cols-[repeat(3,4px)]");
    expect(html).toContain("pixel-on");
    expect(html).toContain("shimmer-text");
    expect(html).not.toContain("text-orange");
    expect(html).not.toContain("animate-spin");
  });
});
