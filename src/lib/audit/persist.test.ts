import { describe, expect, it, vi } from "vitest";
import type { EvidenceTrace } from "./evidenceTrace";
import type { AuditContextPackV1 } from "./auditContext";

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
      auditContext: {
        version: 1,
        audited: {
          url: "https://example.com/",
          domain: "example.com",
          timestamp: "2026-08-30T00:00:00.000Z",
        },
      } as AuditContextPackV1,
      reportId: "8e922049-9cd3-4ca3-a6f1-395545ab689f",
    });

    expect(row.evidence_trace?.stopReason).toBe("discovery_failed");
    expect(row.evidence_trace?.coverage).toEqual(evidenceTrace.coverage);
    expect(JSON.stringify(row.evidence_trace)).not.toContain("markdown");
    expect(row.id).toBe("8e922049-9cd3-4ca3-a6f1-395545ab689f");
    expect(row.audit_context?.reportId).toBe(
      "8e922049-9cd3-4ca3-a6f1-395545ab689f"
    );
    expect(row.audit_context?.version).toBe(1);
    expect(JSON.stringify(row.audit_context)).not.toContain("markdown");
  });

  it("supports legacy persistence without audit_context", () => {
    const row = buildPersistedReportRow({
      url: "https://example.com",
      company_name: "Example",
      audit: { overallScore: 70 },
    });

    expect(row.audit_context).toBeNull();
    expect(row.evidence_trace).toBeNull();
  });
});
