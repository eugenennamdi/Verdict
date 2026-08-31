import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deriveCanonicalReportFacts,
  projectCanonicalReportFacts,
} from "@/lib/audit/canonicalReport";
import { answerDeterministically } from "@/lib/conversation/auditQuestions";
import {
  makeAuditContext,
  makeLoadedAuditContext,
} from "@/lib/conversation/__testutils__/auditContext";
import { AuditResultCard } from "./AuditResultCard";
import {
  hydrateRecentCanonicalFacts,
  scoreFreePillars,
} from "./recentCanonicalFacts";
import type { AuditSummary, RecentInvestigation } from "./types";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_REPORT_ID = "22222222-2222-4222-8222-222222222222";

function scoreFreeSummary(reportId = REPORT_ID): AuditSummary {
  const context = makeAuditContext();
  return {
    reportId,
    overallScore: context.outcome.overallScore,
    identity: context.companyIdentity,
    the_verdict: context.outcome.finalVerdict,
    priority_matrix: context.priorityMatrix,
    pillars: Object.fromEntries(
      Object.entries(context.pillars).map(([key, pillar]) => [
        key,
        {
          confidence: pillar.confidence,
          reason: pillar.reason,
          strengths: pillar.strengths,
          weaknesses: pillar.weaknesses,
        },
      ])
    ),
  };
}

function recent(
  reportId = REPORT_ID,
  result = scoreFreeSummary(reportId)
): RecentInvestigation {
  return {
    id: `recent-${reportId}`,
    url: "https://example.com/",
    domain: "example.com",
    companyName: "Example",
    score: result.overallScore,
    reportId,
    timestamp: 1,
    result,
  };
}

function canonicalResponse(reportId: string, context = makeAuditContext()) {
  context.reportId = reportId;
  return Response.json({
    reportId,
    canonicalReportFacts: projectCanonicalReportFacts(context),
  });
}

describe("Recent Audits canonical report hydration", () => {
  it("makes a restored score-free card agree with Q&A for the exact reportId", async () => {
    const item = recent();
    const hydrated = await hydrateRecentCanonicalFacts(
      item,
      vi.fn(async () => canonicalResponse(REPORT_ID))
    );
    const result = hydrated.result!;
    const cardFacts = deriveCanonicalReportFacts(result);
    const strongestAnswer = answerDeterministically(
      { type: "strongest_dimension" },
      makeLoadedAuditContext(),
      "What is the strongest pillar?"
    )!;
    const weakestAnswer = answerDeterministically(
      { type: "weakest_dimension" },
      makeLoadedAuditContext(),
      "What is the weakest pillar?"
    )!;
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, { result })
    );

    expect(cardFacts.strongestDimension.label).toBe("Positioning");
    expect(cardFacts.weakestDimension.label).toBe("Market & Competition");
    expect(strongestAnswer.answer).toContain(
      cardFacts.strongestDimension.label
    );
    expect(weakestAnswer.answer).toContain(cardFacts.weakestDimension.label);
    expect(html).toContain("Strongest");
    expect(html).toContain("Positioning");
    expect(html).toContain("Weakest");
    expect(html).toContain("Market &amp; Competition");
  });

  it("round-trips fresh completion and restored facts without pillar scores", async () => {
    const context = makeAuditContext();
    const freshProjection = projectCanonicalReportFacts(context);
    const hydrated = await hydrateRecentCanonicalFacts(
      recent(),
      async () => canonicalResponse(REPORT_ID, context)
    );

    expect(hydrated.result?.canonicalReportFacts).toEqual(freshProjection);
    expect(hydrated.result?.pillars?.positioning).not.toHaveProperty("score");
    expect(hydrated.result?.pillars?.competition).not.toHaveProperty("score");
  });

  it("keeps multiple audits for one domain isolated by reportId", async () => {
    const firstContext = makeAuditContext();
    const secondContext = makeAuditContext();
    secondContext.reportId = SECOND_REPORT_ID;
    secondContext.pillars.positioning.score = 40;
    secondContext.pillars.website_ux.score = 99;
    secondContext.pillars.competition.score = 70;
    secondContext.pillars.conversion.score = 20;

    const fetchCanonical = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return url.includes(SECOND_REPORT_ID)
        ? canonicalResponse(SECOND_REPORT_ID, secondContext)
        : canonicalResponse(REPORT_ID, firstContext);
    });

    const first = await hydrateRecentCanonicalFacts(
      recent(REPORT_ID),
      fetchCanonical
    );
    const second = await hydrateRecentCanonicalFacts(
      recent(SECOND_REPORT_ID),
      fetchCanonical
    );

    expect(first.domain).toBe(second.domain);
    expect(first.reportId).not.toBe(second.reportId);
    expect(
      first.result?.canonicalReportFacts?.strongestDimension?.key
    ).toBe("positioning");
    expect(
      second.result?.canonicalReportFacts?.strongestDimension?.key
    ).toBe("website_ux");
    expect(
      second.result?.canonicalReportFacts?.weakestDimension?.key
    ).toBe("conversion");
    expect(fetchCanonical).toHaveBeenNthCalledWith(
      1,
      `/api/report/${REPORT_ID}?view=canonical`
    );
    expect(fetchCanonical).toHaveBeenNthCalledWith(
      2,
      `/api/report/${SECOND_REPORT_ID}?view=canonical`
    );
  });

  it("does not fabricate a zero-score ranking when the server says it is unavailable", async () => {
    const context = makeAuditContext();
    context.pillars = {} as typeof context.pillars;
    const hydrated = await hydrateRecentCanonicalFacts(
      recent(),
      async () => canonicalResponse(REPORT_ID, context)
    );
    const html = renderToStaticMarkup(
      createElement(AuditResultCard, { result: hydrated.result! })
    );

    expect(
      hydrated.result?.canonicalReportFacts?.dimensionRankingAvailable
    ).toBe(false);
    expect(html).not.toContain("Strongest");
    expect(html).not.toContain("Weakest");
  });

  it("strips historic numeric pillar scores before persisting a recent snapshot", () => {
    const pillars = scoreFreePillars({
      positioning: {
        score: 99,
        confidence: "High",
        reason: "Clear positioning.",
        strengths: ["Specific ICP"],
        weaknesses: [],
      },
    });

    expect(pillars?.positioning).toEqual({
      confidence: "High",
      reason: "Clear positioning.",
      strengths: ["Specific ICP"],
      weaknesses: [],
    });
    expect(pillars?.positioning).not.toHaveProperty("score");
  });
});
