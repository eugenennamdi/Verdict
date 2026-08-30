import { describe, expect, it } from "vitest";
import { createEvidencePage } from "./evidence";
import { assignEvidenceSourceIds } from "./source";

describe("audit evidence source IDs", () => {
  it("assigns deterministic IDs with the acquired homepage first", () => {
    const sources = assignEvidenceSourceIds([
      createEvidencePage({
        url: "https://example.com/pricing",
        role: "supporting",
        category: "conversion",
        acquisitionMethod: "firecrawl",
        markdown: "Pricing evidence",
        status: "acquired",
      }),
      createEvidencePage({
        url: "https://example.com/security",
        role: "supporting",
        category: "trust",
        acquisitionMethod: "none",
        status: "failed",
      }),
      createEvidencePage({
        url: "https://example.com",
        role: "homepage",
        category: "identity",
        acquisitionMethod: "jina",
        markdown: "Homepage evidence",
        status: "acquired",
      }),
    ]);

    expect(sources.map(({ sourceId, url }) => ({ sourceId, url }))).toEqual([
      { sourceId: "S1", url: "https://example.com/" },
      { sourceId: "S2", url: "https://example.com/pricing" },
    ]);
    expect(sources.some((source) => source.url.endsWith("/security"))).toBe(
      false
    );
  });
});
