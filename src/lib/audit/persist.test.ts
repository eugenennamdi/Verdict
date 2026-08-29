import { describe, expect, it, vi } from "vitest";
import type { EvidenceTrace } from "./evidenceTrace";

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: {} }));

import { buildPersistedReportRow } from "./persist";

describe("report persistence payload", () => {
  it("persists typed stop reason and evidence coverage in evidence_trace", () => {
    const evidenceTrace: EvidenceTrace = {
      version: 1,
      pages: [],
      coverage: {
        identity: "medium",
        positioning: "medium",
        messaging: "medium",
        conversion: "low",
        trust: "low",
        market: "low",
        growth: "low",
      },
      planningRounds: 1,
      budget: {
        pagesInspected: 1,
        pagesUsed: 2,
        maxPages: 5,
        evidenceChars: 1200,
        maxEvidenceChars: 80_000,
        planningRounds: 1,
        maxPlanningRounds: 3,
        gatherTimeoutMs: 40_000,
      },
      stopReason: "discovery_failed",
    };

    const row = buildPersistedReportRow({
      url: "https://example.com",
      company_name: "Example",
      audit: { overallScore: 70 },
      evidenceTrace,
    });

    expect(row.evidence_trace?.stopReason).toBe("discovery_failed");
    expect(row.evidence_trace?.coverage).toEqual(evidenceTrace.coverage);
    expect(JSON.stringify(row.evidence_trace)).not.toContain("markdown");
  });
});
