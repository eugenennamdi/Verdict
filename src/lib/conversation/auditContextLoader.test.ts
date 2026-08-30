import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: {} }));

import { makeAuditContext } from "./__testutils__/auditContext";
import {
  AuditContextLoadError,
  buildLegacyAuditContext,
  loadAuditContext,
} from "./auditContextLoader";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";

describe("server-side audit context loading", () => {
  it("loads authoritative audit_context by validated report ID", async () => {
    const lookup = vi.fn(async (reportId: string) => ({
      data: {
        id: reportId,
        audit_context: makeAuditContext(),
      },
    }));

    const loaded = await loadAuditContext(REPORT_ID, { lookup });

    expect(lookup).toHaveBeenCalledWith(REPORT_ID);
    expect(loaded).toMatchObject({
      reportId: REPORT_ID,
      provenance: "audit_context",
      sourceSemanticsAvailable: true,
    });
    expect(loaded?.context.sources.map((source) => source.sourceId)).toEqual([
      "S1",
      "S2",
    ]);
  });

  it("builds a compact legacy fallback when audit_context is null", async () => {
    const legacyRow = {
      id: REPORT_ID,
      company_name: "Legacy Co",
      url: "https://legacy.example.com",
      fdi_overall_score: 58,
      executive_summary: "Legacy summary",
      top_5_priorities: [],
      key_risks: {},
      growth_plan_30_day: {
        positioning: { score: 60 },
        messaging: { score: 60 },
        website_ux: { score: 60 },
        conversion: { score: 50 },
        trust: { score: 50 },
        competition: { score: 50 },
        growth_foundation: { score: 60 },
      },
      created_at: "2025-01-01T00:00:00.000Z",
      audit_context: null,
      evidence_trace: {
        version: 1,
        pages: [
          {
            url: "https://legacy.example.com/",
            path: "/",
            role: "homepage",
            category: "identity",
            acquisitionMethod: "firecrawl",
            chars: 900,
            status: "acquired",
          },
        ],
        coverage: { identity: "medium" },
        planningRounds: 0,
        stopReason: "discovery_failed",
      },
    };
    const loaded = await loadAuditContext(REPORT_ID, {
      lookup: async () => ({ data: legacyRow }),
    });

    expect(loaded?.provenance).toBe("legacy_fallback");
    expect(loaded?.sourceSemanticsAvailable).toBe(false);
    expect(loaded?.context).toMatchObject({
      reportId: REPORT_ID,
      companyIdentity: { company_name: "Legacy Co" },
      outcome: { overallScore: 58 },
      investigation: { stopReason: "discovery_failed" },
      sources: [{ sourceId: "S1", path: "/", keyFindings: [] }],
    });
  });

  it("supports direct legacy construction and canonical framework metadata", () => {
    const context = buildLegacyAuditContext({
      id: REPORT_ID,
      company_name: "Old",
      url: "https://old.example.com",
      fdi_overall_score: 40,
      audit_context: null,
    });

    expect(context.framework.id).toBe("verdict-growth-readiness");
    expect(context.version).toBe(1);
    expect(context.sources).toEqual([]);
  });

  it("rejects invalid IDs before querying and never exposes database errors", async () => {
    const lookup = vi.fn();
    await expect(loadAuditContext("not-a-report-id", { lookup })).rejects.toEqual(
      new AuditContextLoadError("Invalid report reference")
    );
    expect(lookup).not.toHaveBeenCalled();

    await expect(
      loadAuditContext(REPORT_ID, {
        lookup: async () => ({
          data: null,
          error: new Error("SECRET_DATABASE_DETAIL"),
        }),
      })
    ).rejects.toThrow("Unable to load report");
  });

  it("returns null for an unknown report", async () => {
    await expect(
      loadAuditContext(REPORT_ID, {
        lookup: async () => ({ data: null }),
      })
    ).resolves.toBeNull();
  });
});
