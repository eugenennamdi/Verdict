import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/lib/audit/events";
import type { AuditSummary } from "./types";
import { ContextualPanel } from "./ContextualPanel";

function renderPanel(props: Partial<Parameters<typeof ContextualPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(ContextualPanel, {
      phase: "investigating",
      events: [],
      startTime: Date.now() - 12000,
      targetUrl: "https://linear.app",
      targetDomain: "linear.app",
      isOpen: true,
      onClose: () => undefined,
      ...props,
    })
  );
}

describe("ContextualPanel audit context presentation", () => {
  it("renders the panel header with Audit Context title, elapsed time, and accessible close button", () => {
    const html = renderPanel();
    expect(html).toContain("Audit Context");
    expect(html).toContain("aria-label=\"Close audit context\"");
    expect(html).not.toContain("shimmerBar");
  });

  it("renders real operational activity events without stray root slash detail", () => {
    const events: ActivityEvent[] = [
      { type: "audit.started", ts: 1, message: "Started" },
      { type: "site.homepage_acquired", ts: 2, message: "Acquired", data: { url: "https://linear.app" } },
      { type: "evidence.acquired", ts: 3, message: "Pricing acquired", data: { url: "https://linear.app/pricing", category: "conversion" } },
    ];
    const html = renderPanel({ events });
    expect(html).toContain("Activity");
    expect(html).toContain("Investigation started");
    expect(html).toContain("Homepage acquired");
    expect(html).toContain("/pricing");
    // Ensure stray "/" is not rendered as an isolated detail line
    expect(html).not.toContain(">\n/\n<");
    expect(html).not.toContain("> / <");
  });

  it("renders sources with accessible external links and paths", () => {
    const events: ActivityEvent[] = [
      {
        type: "evidence.acquired",
        ts: 1,
        message: "Acquired",
        data: { url: "https://linear.app/pricing", path: "/pricing", category: "conversion" },
      },
    ];
    const html = renderPanel({ events });
    expect(html).toContain("Sources");
    expect(html).toContain("/pricing");
    expect(html).toContain("Conversion");
    expect(html).toContain("aria-label=\"Open source /pricing in a new tab\"");
  });

  it("renders evidence coverage with depth subtitle and no fake score indicators", () => {
    const html = renderPanel({
      auditResult: {
        finalCoverage: {
          identity: "high",
          positioning: "medium",
          messaging: "low",
          conversion: "high",
          trust: "medium",
          market: "low",
          growth: "low",
        },
      } as unknown as AuditSummary,
    });
    expect(html).toContain("Evidence coverage");
    expect(html).toContain("Depth · not a score");
    expect(html).toContain("identity");
    expect(html).toContain("high");
  });

  it("renders extracted startup context in a semantic definition list", () => {
    const auditResult: Partial<AuditSummary> = {
      identity: {
        company_name: "Linear",
        inferred_description: "Issue tracking built for speed",
        target_audience: "High-growth software teams",
        primary_cta: "Start for free",
      },
    };
    const html = renderPanel({
      phase: "complete",
      auditResult: auditResult as AuditSummary,
    });
    expect(html).toContain("Extracted context");
    expect(html).toContain("Linear");
    expect(html).toContain("Issue tracking built for speed");
    expect(html).toContain("High-growth software teams");
    expect(html).toContain("Start for free");
  });

  it("renders evaluation framework with section-level Evaluating status and neutral pending pillars during grading", () => {
    const events: ActivityEvent[] = [
      { type: "audit.started", ts: 1, message: "Started" },
      { type: "scoring.started", ts: 2, message: "Scoring" },
    ];
    const html = renderPanel({ phase: "investigating", events });
    expect(html).toContain("Evaluation");
    expect(html).toContain("Evaluating");
    // Ensure pillars are not rendered as individually active orange fills
    expect(html).not.toContain("fill-orange-500");
    expect(html).toContain("1. Positioning &amp; ICP");
    expect(html).toContain("7. Growth Foundation");
  });

  it("renders completed checkmarks on pillars when audit is complete", () => {
    const html = renderPanel({ phase: "complete" });
    expect(html).toContain("Evaluation");
    expect(html).toContain("7 pillars");
    expect(html).toContain("1. Positioning &amp; ICP");
    expect(html).toContain("7. Growth Foundation");
  });
});
