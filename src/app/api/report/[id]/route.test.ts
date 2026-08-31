import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { makeLoadedAuditContext } from "@/lib/conversation/__testutils__/auditContext";
import { buildLegacyAuditContext } from "@/lib/conversation/auditContextLoader";
import { createReportHandler } from "./route";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";

function params(id = REPORT_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/report/[id] canonical human-workspace projection", () => {
  it("returns server-derived qualitative facts without pillar scores", async () => {
    const loaded = makeLoadedAuditContext();
    const loadContext = vi.fn(async () => loaded);
    const lookup = vi.fn();
    const handler = createReportHandler({ loadContext, lookup });

    const response = await handler(
      new Request(
        `http://localhost/api/report/${REPORT_ID}?view=canonical`
      ),
      params()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadContext).toHaveBeenCalledWith(REPORT_ID);
    expect(lookup).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      reportId: REPORT_ID,
      canonicalReportFacts: {
        reportId: REPORT_ID,
        overallScore: 69,
        dimensionRankingAvailable: true,
        strongestDimension: { key: "positioning", label: "Positioning" },
        weakestDimension: {
          key: "competition",
          label: "Market & Competition",
        },
        primaryBottleneck: "Trust proof is thin.",
        highestOpportunity: "Strengthen customer evidence.",
        priorities: [{ task: "Publish a customer case study" }],
      },
    });
    expect(payload).not.toHaveProperty("pillars");
    expect(payload).not.toHaveProperty("growth_plan_30_day");
    expect(payload.canonicalReportFacts.strongestDimension).not.toHaveProperty(
      "score"
    );
    expect(payload.canonicalReportFacts.weakestDimension).not.toHaveProperty(
      "score"
    );
  });

  it("adds the same canonical projection to the full human report response", async () => {
    const loaded = makeLoadedAuditContext();
    const handler = createReportHandler({
      loadContext: async () => loaded,
      lookup: async () => ({
        data: {
          id: REPORT_ID,
          company_name: "STALE NAME",
          fdi_overall_score: 1,
          growth_plan_30_day: {
            positioning: { score: 99, reason: "Persisted reason." },
          },
          audit_context: {
            pillars: { positioning: { score: 99 } },
          },
        },
      }),
    });

    const response = await handler(
      new Request(`http://localhost/api/report/${REPORT_ID}`),
      params()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canonicalReportFacts).toMatchObject({
      reportId: REPORT_ID,
      companyName: "Example",
      overallScore: 69,
      strongestDimension: { key: "positioning" },
      weakestDimension: { key: "competition" },
    });
    expect(payload.growth_plan_30_day.positioning).toEqual({
      reason: "Persisted reason.",
    });
    expect(payload.growth_plan_30_day.positioning).not.toHaveProperty("score");
    expect(payload).not.toHaveProperty("audit_context");
  });

  it("does not fabricate ranking labels when authoritative scores are absent", async () => {
    const loaded = makeLoadedAuditContext();
    loaded.context.pillars = {} as typeof loaded.context.pillars;
    const handler = createReportHandler({
      loadContext: async () => loaded,
      lookup: vi.fn(),
    });

    const response = await handler(
      new Request(
        `http://localhost/api/report/${REPORT_ID}?view=canonical`
      ),
      params()
    );
    const payload = await response.json();

    expect(payload.canonicalReportFacts.dimensionRankingAvailable).toBe(false);
    expect(payload.canonicalReportFacts).not.toHaveProperty(
      "strongestDimension"
    );
    expect(payload.canonicalReportFacts).not.toHaveProperty(
      "weakestDimension"
    );
  });

  it("derives a safe projection for a legacy persisted report with internal scores", async () => {
    const context = buildLegacyAuditContext({
      id: REPORT_ID,
      company_name: "Legacy Example",
      url: "https://example.com/",
      fdi_overall_score: 72,
      audit_context: null,
      growth_plan_30_day: {
        positioning: { score: 80 },
        messaging: { score: 75 },
        website_ux: { score: 99 },
        conversion: { score: 55 },
        trust: { score: 70 },
        competition: { score: 65 },
        growth_foundation: { score: 60 },
      },
    });
    const handler = createReportHandler({
      loadContext: async () => ({
        reportId: REPORT_ID,
        context,
        provenance: "legacy_fallback",
        sourceSemanticsAvailable: false,
      }),
      lookup: vi.fn(),
    });

    const response = await handler(
      new Request(
        `http://localhost/api/report/${REPORT_ID}?view=canonical`
      ),
      params()
    );
    const payload = await response.json();

    expect(payload.canonicalReportFacts).toMatchObject({
      overallScore: 72,
      dimensionRankingAvailable: true,
      strongestDimension: { key: "website_ux", label: "Website & UX" },
      weakestDimension: { key: "conversion", label: "Conversion" },
    });
    expect(payload.canonicalReportFacts.strongestDimension).not.toHaveProperty(
      "score"
    );
    expect(payload.canonicalReportFacts.weakestDimension).not.toHaveProperty(
      "score"
    );
  });
});
