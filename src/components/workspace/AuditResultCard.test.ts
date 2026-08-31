import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AuditSummary } from "./types";
import { AuditResultCard } from "./AuditResultCard";

function sampleResult(overrides: Partial<AuditSummary> = {}): AuditSummary {
  return {
    reportId: "rep_linear_123",
    overallScore: 86,
    identity: {
      company_name: "Linear",
      inferred_description: "The issue tracking tool you'll actually enjoy using.",
      target_audience: "High-growth product and engineering teams",
      primary_cta: "Sign up free",
    },
    the_verdict: {
      primary_constraint: "Pricing transparency on homepage is absent.",
      highest_opportunity: "Add pricing tiers directly to navigation.",
    },
    priority_matrix: [
      {
        task: "Add visible pricing page link on homepage",
        why: "Reduces friction for price-sensitive buyers.",
        impact: "High",
      },
      {
        task: "Simplify hero message for faster comprehension",
        why: "Improves immediate conversion rate for first-time visitors.",
        impact: "Medium",
      },
      {
        task: "Add customer success metrics on homepage",
        why: "Concrete numbers enhance enterprise credibility.",
        impact: "High",
      },
    ],
    pillars: {
      website_ux: { score: 92 },
      positioning: { score: 85 },
      messaging: { score: 80 },
      conversion: { score: 78 },
      trust: { score: 75 },
      competition: { score: 70 },
      growth_foundation: { score: 65 },
    },
    evidence: [
      {
        url: "https://linear.app/",
        path: "/",
        role: "homepage",
        category: "identity",
        status: "acquired",
        acquisitionMethod: "firecrawl",
        chars: 5000,
      },
      {
        url: "https://linear.app/pricing",
        path: "/pricing",
        role: "supporting",
        category: "conversion",
        status: "acquired",
        acquisitionMethod: "firecrawl",
        chars: 3000,
      },
    ],
    ...overrides,
  };
}

describe("AuditResultCard editorial intelligence brief", () => {
  it("renders the company name and score", () => {
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, {
        result: sampleResult(),
        onOpenAuditContext: vi.fn(),
      })
    );

    expect(html).toContain("Linear");
    expect(html).toContain("86");
    expect(html).toContain("/100");
    expect(html).not.toContain("Growth readiness");
    expect(html).toContain("The issue tracking tool you&#x27;ll actually enjoy using.");
  });

  it("does not render internal evidence depth line", () => {
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, {
        result: sampleResult(),
      })
    );

    expect(html).not.toContain("Evidence depth");
    expect(html).not.toContain("2 pages inspected");
  });

  it("renders primary bottleneck with editorial typography without alert box", () => {
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, {
        result: sampleResult(),
      })
    );

    expect(html).toContain("Primary bottleneck");
    expect(html).toContain("Pricing transparency on homepage is absent.");
    expect(html).not.toContain("AlertTriangle");
  });

  it("renders recommended priorities in a numbered list with impact tags", () => {
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, {
        result: sampleResult(),
      })
    );

    expect(html).toContain("Recommended priorities");
    expect(html).toContain("01");
    expect(html).toContain("Add visible pricing page link on homepage");
    expect(html).toContain("High impact");
    expect(html).toContain("02");
    expect(html).toContain("Simplify hero message for faster comprehension");
    expect(html).toContain("Medium impact");
    expect(html).toContain("03");
    expect(html).toContain("Add customer success metrics on homepage");
  });

  it("renders strongest and weakest pillars in a clean comparative layout", () => {
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, {
        result: sampleResult(),
      })
    );

    expect(html).toContain("Strongest");
    expect(html).toContain("Website &amp; UX");
    expect(html).toContain("Weakest");
    expect(html).toContain("Growth Foundation");
  });

  it("renders action buttons for Audit context and View full report", () => {
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, {
        result: sampleResult(),
      })
    );

    expect(html).toContain("Audit context");
    expect(html).toContain("View full report");
    expect(html).toContain("/report/rep_linear_123");
  });
});
