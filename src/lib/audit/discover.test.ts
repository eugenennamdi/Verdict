import { describe, expect, it } from "vitest";
import type { LookupFn } from "@/lib/security/url";
import {
  classifyEvidencePath,
  discoverInternalPages,
} from "./discover";

const publicLookup: LookupFn = async () => [
  { address: "8.8.8.8", family: 4 },
];

function mapped(links: Array<string | { url: string }>) {
  return async () => ({ success: true, links });
}

describe("discoverInternalPages", () => {
  it("accepts same-site candidates and rejects external candidates", async () => {
    const candidates = await discoverInternalPages("https://example.com", {
      lookup: publicLookup,
      mapDiscovery: mapped([
        { url: "https://example.com/pricing" },
        { url: "https://docs.example.com/product" },
        { url: "https://external.test/pricing" },
      ]),
    });

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://example.com/pricing",
      "https://docs.example.com/product",
    ]);
  });

  it("deduplicates candidates and removes fragments and trailing slashes", async () => {
    const candidates = await discoverInternalPages("https://example.com", {
      lookup: publicLookup,
      mapDiscovery: mapped([
        "http://example.com/pricing/#faq",
        "https://example.com/pricing",
        "https://example.com/pricing?ref=nav#plans",
      ]),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      url: "https://example.com/pricing",
      path: "/pricing",
      category: "conversion",
    });
  });

  it("rejects static assets and obvious account paths", async () => {
    const candidates = await discoverInternalPages("https://example.com", {
      lookup: publicLookup,
      mapDiscovery: mapped([
        "https://example.com/assets/logo.svg",
        "https://example.com/_next/app.js",
        "https://example.com/account",
        "https://example.com/case-studies/acme",
      ]),
    });

    expect(candidates.map((candidate) => candidate.path)).toEqual([
      "/case-studies/acme",
    ]);
  });

  it("enforces the candidate cap", async () => {
    const candidates = await discoverInternalPages("https://example.com", {
      lookup: publicLookup,
      limit: 3,
      mapDiscovery: mapped(
        Array.from(
          { length: 10 },
          (_, index) => `https://example.com/page-${index}`
        )
      ),
    });

    expect(candidates).toHaveLength(3);
  });

  it("returns an empty list when map discovery fails", async () => {
    const candidates = await discoverInternalPages("https://example.com", {
      lookup: publicLookup,
      mapDiscovery: async () => {
        throw new Error("map unavailable");
      },
    });

    expect(candidates).toEqual([]);
  });
});

describe("classifyEvidencePath", () => {
  it.each([
    ["/pricing", "conversion"],
    ["/customers/acme", "trust"],
    ["/features", "positioning"],
    ["/about", "identity"],
    ["/compare/legacy-tool", "market"],
    ["/docs/getting-started", "growth"],
  ])("classifies %s as %s", (path, category) => {
    const result = classifyEvidencePath(path);
    expect(result.category).toBe(category);
    expect(result.ranking.priority).toBeGreaterThan(0);
    expect(result.ranking.matchedKeyword).toBeTruthy();
  });

  it("does not claim a category for an unknown path", () => {
    expect(classifyEvidencePath("/legal/terms")).toEqual({
      ranking: { priority: 0 },
    });
  });
});
