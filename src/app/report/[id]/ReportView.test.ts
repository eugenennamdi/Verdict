import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportView, type ReportData } from "./ReportView";

const sampleReport: ReportData = {
  id: "rep_morpho_123",
  company_name: "Morpho",
  url: "https://morpho.org",
  fdi_overall_score: 81,
  executive_summary:
    "Morpho presents a sophisticated decentralized lending protocol with exceptional trust mechanics but needs clearer conversion pathways for non-technical users.",
  key_risks: {
    status: "Strong",
    primary_constraint:
      "Documentation and protocol layers dominate navigation, creating high friction for standard liquidity providers.",
    highest_opportunity:
      "Introduce self-serve guided vault selection directly on the homepage.",
    estimated_impact:
      "Reduces first-deposit drop-off by an estimated 22% within 30 days.",
  },
  growth_plan_30_day: {
    positioning: {
      score: 88,
      reason:
        "Positioning as a hyper-efficient lending primitive is distinct against legacy lending pools.",
      confidence: "High",
      strengths: [
        "Crystal clear value prop for institutional and DeFi-native capital",
        "Clear differentiation vs monolithic lending pools",
      ],
      weaknesses: [
        "Fails to address retail / beginner lender personas",
      ],
    },
    messaging: {
      score: 80,
      reason:
        "Copy is crisp and mathematically precise, though jargon-heavy in secondary sections.",
      confidence: "High",
      strengths: [
        "Direct headline explaining peer-to-peer matching efficiency",
      ],
      weaknesses: [
        "Dense financial terminology in above-the-fold subheadings",
      ],
    },
    website_ux: {
      score: 85,
      reason:
        "Interface is exceptionally fast and responsive with minimal visual clutter.",
      confidence: "High",
      strengths: [
        "Sub-100ms interaction latency",
        "High-contrast data tables",
      ],
      weaknesses: [
        "Navigation bar lacks direct CTA for deposit vaults",
      ],
    },
    conversion: {
      score: 74,
      reason:
        "Primary CTA routes to documentation instead of application onboarding.",
      confidence: "High",
      strengths: [
        "Wallet connection is seamless once app is loaded",
      ],
      weaknesses: [
        "Two extra clicks required to reach deposit flow from homepage",
      ],
    },
    trust: {
      score: 95,
      reason:
        "Formal verification and multi-firm security audits provide top-tier institutional assurance.",
      confidence: "High",
      strengths: [
        "Prominent audit reports from leading security firms",
        "Over $2B TVL security track record",
      ],
      weaknesses: [
        "Insurance/coverage details require searching through docs",
      ],
    },
    competition: {
      score: 82,
      reason:
        "Strong network effects among DeFi integrators create a defensible liquidity moat.",
      confidence: "Medium",
      strengths: [
        "Deep integrations across Base and Ethereum mainnet",
      ],
      weaknesses: [
        "Competitor comparison page does not exist",
      ],
    },
    growth_foundation: {
      score: 78,
      reason:
        "Analytics and ecosystem telemetry are robust, though referral loops are absent.",
      confidence: "Medium",
      strengths: [
        "Live onchain metrics dashboard",
      ],
      weaknesses: [
        "No incentive mechanism for community-driven referrals",
      ],
    },
  },
  top_5_priorities: [
    {
      task: "Add direct 'Enter App' primary CTA on homepage header",
      why: "Eliminates confusion between documentation and deposit interface.",
      impact: "High",
      effort: "Low",
    },
    {
      task: "Publish transparent APY breakdown vs legacy lending pools",
      why: "Clearly illustrates matching efficiency gains for prospective capital allocators.",
      impact: "High",
      effort: "Medium",
    },
    {
      task: "Simplify vault discovery with curated risk tiers",
      why: "Reduces decision fatigue for new depositors.",
      impact: "Medium",
      effort: "Medium",
    },
  ],
};

describe("ReportView standalone editorial full report", () => {
  it("renders header with company name, clean URL, and overall score metadata", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).toContain("Morpho");
    expect(html).toContain("morpho.org");
    expect(html).toContain("81");
    expect(html).toContain("/100");
    expect(html).toContain("Growth Readiness Score");
    expect(html).toContain("Back to audit");
  });

  it("omits legacy public artifacts (no OKX, no X Layer, no Attested Onchain)", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).not.toContain("X Layer");
    expect(html).not.toContain("Attested Onchain");
    expect(html).not.toContain("okx.com");
    expect(html).not.toContain("static.okx.com");
    expect(html).not.toContain("Attested onchain via @XLayerOfficial");
  });

  it("omits the old 4-card bento/dashboard tiles and giant Strong status tile", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).not.toContain("bg-blue-50/40");
    expect(html).not.toContain("bg-rose-50/40");
    expect(html).not.toContain("bg-emerald-50/40");
    expect(html).not.toContain("bg-mesh");
    expect(html).not.toContain("font-black text-4xl tracking-tight text-slate-900 dark:text-white\">Strong</p>");
  });

  it("renders executive assessment, primary bottleneck, and highest-leverage opportunity in one coherent flow", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).toContain("Executive assessment");
    expect(html).toContain("Morpho presents a sophisticated decentralized lending protocol");

    expect(html).toContain("Primary bottleneck");
    expect(html).toContain("Documentation and protocol layers dominate navigation");

    expect(html).toContain("Highest-leverage opportunity");
    expect(html).toContain("Introduce self-serve guided vault selection directly on the homepage.");
    expect(html).toContain("Reduces first-deposit drop-off by an estimated 22% within 30 days.");
  });

  it("renders the 7-pillar analysis sequentially without individual pillar scores", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).toContain("Growth Readiness Analysis");
    expect(html).toContain("01");
    expect(html).toContain("Positioning &amp; ICP");
    expect(html).toContain("05");
    expect(html).toContain("Trust &amp; Social Proof");
    expect(html).toContain("07");
    expect(html).toContain("Growth Foundation");

    // Findings section titles
    expect(html).toContain("What works");
    expect(html).toContain("Areas to improve");
    expect(html).toContain("Crystal clear value prop for institutional and DeFi-native capital");
    expect(html).toContain("Fails to address retail / beginner lender personas");

    // No old progress bars or confidence badges in pillars
    expect(html).not.toContain("role=\"progressbar\"");
    expect(html).not.toContain("bg-emerald-500 rounded-full");
  });

  it("renders recommended priorities action plan with impact and effort metadata without pills", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).toContain("Recommended Priorities");
    expect(html).toContain("Add direct &#x27;Enter App&#x27; primary CTA on homepage header");
    expect(html).toContain("Eliminates confusion between documentation and deposit interface.");
    expect(html).toContain("Impact:");
    expect(html).toContain("High");
    expect(html).toContain("Effort:");
    expect(html).toContain("Low");
  });

  it("renders floating action dock with Save Report, Copy Link, and Share on X", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).toContain("Save Report");
    expect(html).toContain("Copy Link");
    expect(html).toContain("Share on X");
  });

  it("renders concluding audit methodology with Learn more documentation link", () => {
    const html = renderToStaticMarkup(createElement(ReportView, { report: sampleReport }));

    expect(html).toContain("Audit Methodology &amp; Framework");
    expect(html).toContain("Verdict evaluates startup growth readiness across seven foundational dimensions");
    expect(html).toContain("Learn more");
    expect(html).toContain("href=\"/docs\"");
    expect(html).not.toContain("Framework: Verdict Growth Model v2");
    expect(html).not.toContain("Scope: Full Public Surface");
  });
});
