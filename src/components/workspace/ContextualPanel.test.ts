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

describe("ContextualPanel simplified audit context presentation", () => {
  it("renders the quiet panel header with Audit Context title and accessible close button", () => {
    const html = renderPanel();
    expect(html).toContain("Audit Context");
    expect(html).toContain("aria-label=\"Close audit context\"");
    expect(html).not.toContain("Evidence-backed analysis");
    expect(html).not.toContain("Audit intelligence");
  });

  describe("COMPLETED AUDIT STATE", () => {
    const auditResult: Partial<AuditSummary> = {
      company_name: "Linear",
      overallScore: 86,
      identity: {
        company_name: "Linear",
        inferred_description: "Issue tracking built for speed",
        target_audience: "High-growth software teams",
        primary_cta: "Start for free",
      },
      audit_context: {
        sources: [
          { url: "https://linear.app", path: "/", role: "homepage", category: "identity" },
          { url: "https://linear.app/pricing", path: "/pricing", role: "supporting", category: "conversion" },
        ],
      },
      finalCoverage: {
        identity: "high",
        positioning: "high",
        messaging: "medium",
        conversion: "high",
        trust: "medium",
        market: "low",
        growth: "low",
      },
      stopReason: "sufficient",
    };

    it("renders Company Profile and Evaluation, while completely omitting Evidence and Investigation", () => {
      const html = renderPanel({
        phase: "complete",
        events: [],
        auditResult: auditResult as AuditSummary,
      });

      // 1. Company Profile is rendered
      expect(html).toContain("Company Profile");
      expect(html).toContain("Linear");
      expect(html).toContain("Issue tracking built for speed");
      expect(html).toContain("High-growth software teams");
      expect(html).toContain("Start for free");

      // 2. Evaluation is rendered with 7 completed pillars
      expect(html).toContain("Evaluation");
      expect(html).not.toContain("7 pillars");
      expect(html).toContain("1. Positioning &amp; ICP");
      expect(html).toContain("7. Growth Foundation");

      // 3. Evidence section is NOT rendered
      expect(html).not.toContain("id=\"section-evidence\"");
      expect(html).not.toContain("Evidence");
      expect(html).not.toContain("2 sources");
      expect(html).not.toContain("Coverage");
      expect(html).not.toContain("Depth · not a score");

      // 4. Investigation section and telemetry are NOT rendered
      expect(html).not.toContain("id=\"section-investigation\"");
      expect(html).not.toContain("Investigation");
      expect(html).not.toContain("View activity");
      expect(html).not.toContain("Outcome");
      expect(html).not.toContain("Evidence coverage sufficient");
      expect(html).not.toContain("Pages discovered");
      expect(html).not.toContain("Candidates");
    });

    it("orders Company Profile first, then Evaluation second", () => {
      const html = renderPanel({
        phase: "complete",
        events: [],
        auditResult: auditResult as AuditSummary,
      });

      const contextPos = html.indexOf("id=\"section-context\"");
      const evaluationPos = html.indexOf("id=\"section-evaluation\"");

      expect(contextPos).toBeGreaterThan(-1);
      expect(evaluationPos).toBeGreaterThan(contextPos);
    });
  });

  describe("ACTIVE AUDIT STATE", () => {
    it("renders Company Profile and active Evaluation without Evidence, Investigation, or crawler telemetry", () => {
      const events: ActivityEvent[] = [
        { type: "audit.started", ts: 1, message: "Started" },
        { type: "site.pages_discovered", ts: 2, message: "Discovered", data: { count: 40 } },
        { type: "site.homepage_acquired", ts: 3, message: "Acquired", data: { url: "https://linear.app" } },
        { type: "evidence.acquired", ts: 4, message: "Pricing acquired", data: { url: "https://linear.app/pricing", category: "conversion" } },
      ];
      const html = renderPanel({
        phase: "investigating",
        events,
        targetUrl: "https://linear.app",
        targetDomain: "linear.app",
      });

      // Evaluation is rendered with neutral pending indicators
      expect(html).toContain("Evaluation");
      expect(html).not.toContain("7 pillars");
      expect(html).toContain("1. Positioning &amp; ICP");

      // Company Profile placeholder is rendered while investigating
      expect(html).toContain("Company Profile");

      // No internal crawler / investigation telemetry
      expect(html).not.toContain("id=\"section-investigation\"");
      expect(html).not.toContain("Investigation");
      expect(html).not.toContain("Homepage acquired");
      expect(html).not.toContain("/pricing");
      expect(html).not.toContain("40 discovered");
      expect(html).not.toContain("Pages discovered");
      expect(html).not.toContain("Candidate pages evaluated");

      // No Evidence section
      expect(html).not.toContain("id=\"section-evidence\"");
      expect(html).not.toContain("Evidence");
      expect(html).not.toContain("sources");
    });
  });

  describe("FAILED AUDIT STATE", () => {
    it("does NOT render Evidence or Investigation sections on failure", () => {
      const events: ActivityEvent[] = [
        { type: "audit.started", ts: 1, message: "Started" },
        { type: "site.homepage_acquired", ts: 2, message: "Acquired", data: { url: "https://aave.com" } },
        { type: "audit.failed", ts: 3, message: "Failed" },
      ];
      const html = renderPanel({
        phase: "failed",
        events,
        targetUrl: "https://aave.com",
        targetDomain: "aave.com",
      });

      // Header shows quiet Failed badge
      expect(html).toContain("Failed");

      // Evidence and Investigation are completely omitted
      expect(html).not.toContain("id=\"section-evidence\"");
      expect(html).not.toContain("Evidence");
      expect(html).not.toContain("id=\"section-investigation\"");
      expect(html).not.toContain("View activity");
      expect(html).not.toContain("Homepage acquired");
    });

    it("renders minimal empty state when neither company context nor evaluation is available on failure", () => {
      const html = renderPanel({
        phase: "failed",
        events: [{ type: "audit.failed", ts: 1, message: "Failed" }],
      });

      expect(html).toContain("Audit could not continue.");
      expect(html).not.toContain("id=\"section-evidence\"");
      expect(html).not.toContain("id=\"section-investigation\"");
    });
  });
});
