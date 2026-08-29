import { describe, expect, it, vi } from "vitest";
import type { LookupFn } from "@/lib/security/url";

vi.mock("@/lib/engine", () => ({
  fetchContextDetailed: vi.fn(),
}));

import { acquireEvidencePage } from "./acquire";

const publicLookup: LookupFn = async () => [
  { address: "8.8.8.8", family: 4 },
];

describe("acquireEvidencePage", () => {
  it("acquires exactly one homepage through the reusable context primitive", async () => {
    const contextFetcher = vi.fn(async () => ({
      markdown: "homepage evidence",
      method: "provided" as const,
    }));

    const page = await acquireEvidencePage({
      url: "https://example.com",
      role: "homepage",
      category: "identity",
      lookup: publicLookup,
      contextFetcher,
    });

    expect(page).toMatchObject({
      url: "https://example.com/",
      path: "/",
      role: "homepage",
      category: "identity",
      acquisitionMethod: "provided",
      markdown: "homepage evidence",
      chars: 17,
      status: "acquired",
    });
    expect(contextFetcher).toHaveBeenCalledTimes(1);
  });

  it("does not fetch after the page cap is reached", async () => {
    const contextFetcher = vi.fn();
    const page = await acquireEvidencePage({
      url: "https://example.com/pricing",
      pagesUsed: 1,
      budget: { maxPagesTotal: 1 },
      lookup: publicLookup,
      contextFetcher,
    });

    expect(page.status).toBe("skipped");
    expect(contextFetcher).not.toHaveBeenCalled();
  });

  it("truncates acquired content to the remaining character budget", async () => {
    const page = await acquireEvidencePage({
      url: "https://example.com/pricing",
      budget: { maxEvidenceChars: 10 },
      evidenceCharsUsed: 6,
      lookup: publicLookup,
      contextFetcher: async () => ({
        markdown: "abcdefghij",
        method: "firecrawl",
      }),
    });

    expect(page.markdown).toBe("abcd");
    expect(page.chars).toBe(4);
  });

  it("returns a failed page instead of throwing when acquisition fails", async () => {
    const page = await acquireEvidencePage({
      url: "https://example.com/security",
      lookup: publicLookup,
      contextFetcher: async () => {
        throw new Error("unavailable");
      },
    });

    expect(page).toMatchObject({
      status: "failed",
      chars: 0,
      error: "unavailable",
    });
  });
});
