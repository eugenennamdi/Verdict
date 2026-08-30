import { describe, expect, it } from "vitest";
import { ACTIVITY_EVENT_TYPES, type ActivityEvent } from "@/lib/audit/events";
import type { EvidencePageSummary } from "@/lib/audit/evidence";
import {
  auditResultEvidenceLabel,
  conversationalAuditSummary,
  presentActivityEvents,
  successfulEvidenceSources,
} from "./investigationPresentation";

function event(type: ActivityEvent["type"], data?: Record<string, unknown>): ActivityEvent {
  return {
    type,
    ts: 1,
    message: "SECRET_PLANNER_REASONING",
    ...(data ? { data } : {}),
  };
}

describe("workspace investigation presentation", () => {
  it("maps every ActivityEvent type without displaying planner reasoning", () => {
    const events = ACTIVITY_EVENT_TYPES.map((type) =>
      event(type, {
        url: "https://example.com/pricing",
        count: 4,
        category: "conversion",
        categories: ["trust", "market"],
        company_name: "Example",
        reasoning: "SECRET_PLANNER_REASONING",
      })
    );
    const rows = presentActivityEvents(events);

    expect(rows.map((row) => row.type)).toEqual(ACTIVITY_EVENT_TYPES);
    expect(JSON.stringify(rows)).not.toContain("SECRET_PLANNER_REASONING");
    expect(JSON.stringify(rows)).not.toContain("reasoning");
  });

  it("counts only successful pages as inspected sources", () => {
    const evidence: EvidencePageSummary[] = [
      {
        url: "https://example.com/",
        path: "/",
        role: "homepage",
        category: "identity",
        acquisitionMethod: "firecrawl",
        chars: 100,
        status: "acquired",
      },
      {
        url: "https://example.com/security",
        path: "/security",
        role: "supporting",
        category: "trust",
        acquisitionMethod: "none",
        chars: 0,
        status: "failed",
      },
    ];

    expect(successfulEvidenceSources(evidence).map((source) => source.url)).toEqual([
      "https://example.com/",
    ]);
    expect(auditResultEvidenceLabel({
      overallScore: 70,
      identity: { company_name: "Example" },
      evidence,
    })).toBe("1 page inspected");
  });

  it("omits redundant root slash detail on homepage and preserves real sub-paths", () => {
    const rootHomepage = presentActivityEvents([
      event("site.homepage_acquired", { url: "https://example.com/" }),
    ]);
    expect(rootHomepage[0].label).toBe("Homepage acquired");
    expect(rootHomepage[0].detail).toBeUndefined();

    const subpageAcquired = presentActivityEvents([
      event("evidence.acquired", { url: "https://example.com/pricing", category: "conversion" }),
      event("evidence.acquired", { url: "https://example.com/blog", category: "market" }),
    ]);
    expect(subpageAcquired[0].label).toBe("Conversion evidence collected");
    expect(subpageAcquired[0].detail).toBe("/pricing");
    expect(subpageAcquired[1].label).toBe("Market evidence collected");
    expect(subpageAcquired[1].detail).toBe("/blog");
  });

  it("uses neutral language when a hard budget stops the audit", () => {
    const summary = conversationalAuditSummary({
      overallScore: 70,
      identity: { company_name: "Example" },
      pagesInspected: 5,
      stopReason: "page_budget",
    });

    expect(summary).toContain("strongest 5 pages available within this investigation");
    expect(summary).not.toContain("full-site");
    expect(summary).not.toContain("sufficient");
  });
});
