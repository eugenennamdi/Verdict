import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  DOCS_NAVIGATION,
  ALL_DOCS_PAGES,
  getDocsPagination,
  getDocsGroupForHref,
} from "@/lib/docs/navigation";
import { PILLAR_WEIGHTS } from "@/lib/audit/score";
import { HUMAN_AUDIT_QUOTA_LIMIT } from "@/lib/humanAuditQuotaContract";
import { DEFAULT_VERDICT_AUDIT_PRICE } from "@/lib/x402/constants";

const DOCS_DIR = join(process.cwd(), "src/app/docs");

const BANNED_FLUFF_PHRASES = [
  "revolutionary",
  "cutting-edge",
  "ai-powered magic",
  "supercharge your growth",
  "unlock unprecedented insights",
  "brutal honesty",
  "rip it apart",
  "word salad",
];

const BANNED_LEGACY_TOKENS = [
  "x layer",
  "xlayer",
  "okx.ai",
  "asp",
  "usdt",
  "1 audit / 12h",
  "1 audit per 12",
];

describe("Verdict Documentation Overhaul", () => {
  it("defines valid navigation structure across all groups", () => {
    expect(DOCS_NAVIGATION.length).toBeGreaterThanOrEqual(5);

    for (const group of DOCS_NAVIGATION) {
      expect(group.title).toBeTruthy();
      expect(group.items.length).toBeGreaterThan(0);

      for (const item of group.items) {
        expect(item.title).toBeTruthy();
        expect(item.href).toMatch(/^\/docs/);
        expect(item.description).toBeTruthy();
      }
    }
  });

  it("ensures every navigation item has an existing page file", () => {
    for (const item of ALL_DOCS_PAGES) {
      const relPath = item.href.replace(/^\/docs\/?/, "");
      const targetPath = relPath === ""
        ? join(DOCS_DIR, "page.tsx")
        : join(DOCS_DIR, relPath, "page.tsx");

      expect(
        existsSync(targetPath),
        `Page file missing for route: ${item.href} at ${targetPath}`
      ).toBe(true);
    }
  });

  it("calculates sequential pagination forwards and backwards correctly", () => {
    // First page
    const firstPage = ALL_DOCS_PAGES[0];
    const firstPagination = getDocsPagination(firstPage.href);
    expect(firstPagination.prev).toBeUndefined();
    expect(firstPagination.next).toBeDefined();
    expect(firstPagination.next?.href).toBe(ALL_DOCS_PAGES[1].href);

    // Last page
    const lastPage = ALL_DOCS_PAGES[ALL_DOCS_PAGES.length - 1];
    const lastPagination = getDocsPagination(lastPage.href);
    expect(lastPagination.prev).toBeDefined();
    expect(lastPagination.prev?.href).toBe(
      ALL_DOCS_PAGES[ALL_DOCS_PAGES.length - 2].href
    );
    expect(lastPagination.next).toBeUndefined();

    // Intermediate page
    const midPage = ALL_DOCS_PAGES[3];
    const midPagination = getDocsPagination(midPage.href);
    expect(midPagination.prev?.href).toBe(ALL_DOCS_PAGES[2].href);
    expect(midPagination.next?.href).toBe(ALL_DOCS_PAGES[4].href);
  });

  it("finds corresponding navigation group for any valid route", () => {
    expect(getDocsGroupForHref("/docs")?.title).toBe("Getting Started");
    expect(getDocsGroupForHref("/docs/running-an-audit")?.title).toBe("Using Verdict");
    expect(getDocsGroupForHref("/docs/investigation-model")?.title).toBe("How Verdict Works");
    expect(getDocsGroupForHref("/docs/agent-api")?.title).toBe("Agent API");
    expect(getDocsGroupForHref("/docs/security")?.title).toBe("Trust");
    expect(getDocsGroupForHref("/docs/scoring-methodology")?.title).toBe("Reference");
  });

  it("verifies scoring methodology weights match backend PILLAR_WEIGHTS exactly", () => {
    const totalWeight = Object.values(PILLAR_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(Math.round(totalWeight * 100)).toBe(100);

    expect(PILLAR_WEIGHTS.positioning).toBe(0.20);
    expect(PILLAR_WEIGHTS.messaging).toBe(0.15);
    expect(PILLAR_WEIGHTS.website_ux).toBe(0.15);
    expect(PILLAR_WEIGHTS.conversion).toBe(0.15);
    expect(PILLAR_WEIGHTS.trust).toBe(0.10);
    expect(PILLAR_WEIGHTS.competition).toBe(0.10);
    expect(PILLAR_WEIGHTS.growth_foundation).toBe(0.15);
  });

  it("verifies free quota limit constant is 3 and price is $0.50", () => {
    expect(HUMAN_AUDIT_QUOTA_LIMIT).toBe(3);
    expect(DEFAULT_VERDICT_AUDIT_PRICE).toBe("$0.50");
  });

  it("ensures no docs page contains banned marketing fluff or stale tokens", () => {
    for (const item of ALL_DOCS_PAGES) {
      const relPath = item.href.replace(/^\/docs\/?/, "");
      const targetPath = relPath === ""
        ? join(DOCS_DIR, "page.tsx")
        : join(DOCS_DIR, relPath, "page.tsx");

      const content = readFileSync(targetPath, "utf-8").toLowerCase();

      for (const phrase of BANNED_FLUFF_PHRASES) {
        expect(
          content.includes(phrase),
          `Docs page ${item.href} contains banned fluff: "${phrase}"`
        ).toBe(false);
      }

      for (const legacyToken of BANNED_LEGACY_TOKENS) {
        const regex = new RegExp(`\\b${legacyToken}\\b`, "i");
        expect(
          regex.test(content),
          `Docs page ${item.href} contains legacy token: "${legacyToken}"`
        ).toBe(false);
      }
    }
  });
});
