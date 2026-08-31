import { describe, expect, it, vi } from "vitest";
import { admitEvidencePages } from "./admission";
import { createEvidencePage } from "./evidence";

const identity = {
  company_name: "Acme",
  inferred_description: "A deployment platform for software teams",
  target_audience: "Developers",
  primary_cta: "Start deploying",
};

const metadata = {
  requestedPrimaryModel: "gemini-3.7-flash" as const,
  provider: "google" as const,
  model: "gemini-3.7-flash" as const,
  modelUsed: "gemini-3.7-flash" as const,
  tier: "primary" as const,
  fallbackUsed: false,
};

function acquired(url: string, markdown: string) {
  return createEvidencePage({
    url,
    role: "supporting",
    category: "conversion",
    acquisitionMethod: "firecrawl",
    markdown,
    status: "acquired",
  });
}

describe("evidence relevance admission", () => {
  it("accepts relevant product and pricing evidence", async () => {
    const page = acquired(
      "https://acme.test/pricing",
      "Acme deployment plans for developer teams"
    );
    const result = await admitEvidencePages(
      { rootUrl: "https://acme.test", identity, pages: [page] },
      {
        timeoutMs: 1_000,
        generate: vi.fn(async () => ({
          value: JSON.stringify({
            decisions: [
              {
                url: page.url,
                decision: "accepted",
                reasonCode: "company_relevant",
              },
            ],
          }),
          metadata,
        })),
      }
    );

    expect(result[0].admission).toEqual({
      status: "accepted",
      method: "model",
    });
  });

  it("rejects a clearly unrelated same-site business page", async () => {
    const page = acquired(
      "https://acme.test/team/supreme-barbers/beard-trim",
      "Book a beard trim with Supreme Barbers"
    );
    const result = await admitEvidencePages(
      { rootUrl: "https://acme.test", identity, pages: [page] },
      {
        timeoutMs: 1_000,
        generate: vi.fn(async () => ({
          value: JSON.stringify({
            decisions: [
              {
                url: page.url,
                decision: "rejected_irrelevant",
                reasonCode: "unrelated_entity",
              },
            ],
          }),
          metadata,
        })),
      }
    );

    expect(result[0].admission).toEqual({
      status: "rejected_irrelevant",
      method: "model",
      reasonCode: "unrelated_entity",
    });
  });

  it("fails closed when a decision is missing or the model is unavailable", async () => {
    const page = acquired("https://acme.test/about", "About Acme");
    const missing = await admitEvidencePages(
      { rootUrl: "https://acme.test", identity, pages: [page] },
      {
        timeoutMs: 1_000,
        generate: vi.fn(async () => ({
          value: JSON.stringify({ decisions: [] }),
          metadata,
        })),
      }
    );
    const unavailable = await admitEvidencePages(
      { rootUrl: "https://acme.test", identity, pages: [page] },
      {
        timeoutMs: 1_000,
        generate: vi.fn(async () => {
          throw new Error("unavailable");
        }),
      }
    );

    for (const result of [missing, unavailable]) {
      expect(result[0].admission).toMatchObject({
        status: "rejected_irrelevant",
        reasonCode: "relevance_unverified",
      });
    }
  });
});
