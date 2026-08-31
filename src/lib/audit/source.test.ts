import { describe, expect, it } from "vitest";
import { createEvidencePage } from "./evidence";
import { assignEvidenceSourceIds, buildGraderEvidencePack } from "./source";

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
        admission: { status: "accepted", method: "model" },
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

  it("never assigns a source ID to relevance-rejected evidence", () => {
    const sources = assignEvidenceSourceIds([
      createEvidencePage({
        url: "https://example.com",
        role: "homepage",
        category: "identity",
        markdown: "Homepage evidence",
        status: "acquired",
      }),
      createEvidencePage({
        url: "https://example.com/team/unrelated-business",
        role: "supporting",
        category: "identity",
        markdown: "Unrelated business evidence",
        status: "acquired",
        admission: {
          status: "rejected_irrelevant",
          method: "model",
          reasonCode: "unrelated_entity",
        },
      }),
    ]);

    expect(sources.map((source) => source.url)).toEqual([
      "https://example.com/",
    ]);
  });

  it("aligns source IDs with bounded grader content and marks partial evidence", () => {
    const pages = [
      createEvidencePage({
        url: "https://example.com",
        role: "homepage",
        category: "identity",
        markdown: "h".repeat(300),
        status: "acquired",
      }),
      createEvidencePage({
        url: "https://example.com/pricing",
        role: "supporting",
        category: "conversion",
        markdown: "p".repeat(300),
        status: "acquired",
        admission: { status: "accepted", method: "model" },
      }),
    ];
    const pack = buildGraderEvidencePack(pages, { maxEvidenceChars: 500 });

    expect(pack.markdown.length).toBeLessThanOrEqual(500);
    expect(pack.sources.map((source) => source.sourceId)).toEqual(["S1", "S2"]);
    expect(pack.sources.every((source) => pack.markdown.includes(source.sourceId))).toBe(true);
    expect(pack.sources.some((source) => source.truncated)).toBe(true);
  });

  it("does not retain a fully omitted page as a grader-backed source", () => {
    const page = createEvidencePage({
      url: "https://example.com",
      role: "homepage",
      category: "identity",
      markdown: "homepage",
      status: "acquired",
    });
    const pack = buildGraderEvidencePack([page], { maxEvidenceChars: 20 });

    expect(pack.markdown).toBe("");
    expect(pack.sources).toEqual([]);
  });
});
