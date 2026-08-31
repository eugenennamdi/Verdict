import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({
  redis: {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  },
}));

import {
  createConversationHandler,
  isConversationRateLimited,
} from "./route";
import { makeLoadedAuditContext } from "@/lib/conversation/__testutils__/auditContext";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";

function request(body: unknown): Request {
  return new Request("http://localhost/api/conversation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/conversation grounded audit routing", () => {
  it("bounds an unavailable Redis rate-limit preflight and fails open", async () => {
    vi.useFakeTimers();
    const store = {
      incr: vi.fn(() => new Promise<number>(() => undefined)),
      expire: vi.fn(async () => 1),
    };

    const result = isConversationRateLimited(store, "conversation_rate:test", 50);
    await vi.advanceTimersByTimeAsync(50);

    await expect(result).resolves.toBe(false);
    expect(store.expire).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("still enforces the conversation rate limit when Redis responds", async () => {
    const store = {
      incr: vi.fn(async () => 31),
      expire: vi.fn(async () => 1),
    };
    await expect(
      isConversationRateLimited(store, "conversation_rate:test", 50)
    ).resolves.toBe(true);
  });

  it("sanitizes a general provider timeout into a normal fallback response", async () => {
    const handler = createConversationHandler({
      complete: async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    });
    const response = await handler(
      request({ messages: [{ role: "user", content: "Hello" }] })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      action: "respond",
      message: "Whenever you're ready, send a public startup URL and I'll take a look.",
      url: null,
    });
  });

  it("composes an active-report explanation from authoritative report data", async () => {
    const loaded = makeLoadedAuditContext();
    const loadContext = vi.fn(async () => loaded);
    const complete = vi.fn();
    const handler = createConversationHandler({
      loadContext,
      complete,
    });

    const response = await handler(
      request({
        messages: [{ role: "user", content: "Why did Conversion score 60?" }],
        activeReportId: REPORT_ID,
        auditContext: {
          companyIdentity: { company_name: "FABRICATED CLIENT CONTEXT" },
        },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(loadContext).toHaveBeenCalledWith(REPORT_ID);
    expect(complete).not.toHaveBeenCalled();
    expect(JSON.stringify(payload)).not.toContain("FABRICATED CLIENT CONTEXT");
    expect(payload.message).toContain("Conversion was one of the weakest areas");
    expect(payload.message).toContain("conversion reason grounded in the audit");
    expect(payload.message).not.toMatch(/\b60\b|S2/);
    expect(payload).toMatchObject({
      action: "respond",
      auditQa: {
        answerType: "score_explanation",
        citations: [
          {
            sourceId: "S2",
            url: "https://example.com/pricing",
            role: "supporting",
          },
        ],
      },
    });
  });

  it("does not let general-model output override a canonical explanation", async () => {
    const loaded = makeLoadedAuditContext();
    const complete = vi.fn(async () => ({
      content: "Website & UX is strongest and Positioning is weakest.",
      toolCalls: [],
    }));
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      complete,
    });
    const response = await handler(
      request({
        messages: [
          { role: "user", content: "Why did Conversion get that score?" },
        ],
        activeReportId: REPORT_ID,
      })
    );
    const payload = await response.json();

    expect(complete).not.toHaveBeenCalled();
    expect(payload.message).toContain("Conversion was one of the weakest areas");
    expect(payload.message).not.toContain("Website & UX is strongest");
    expect(payload.message).not.toContain("60");
    expect(payload.auditQa).toMatchObject({
      answerType: "score_explanation",
      citations: [{ sourceId: "S2", url: "https://example.com/pricing" }],
    });
    expect(loaded.context.pillars.conversion.score).toBe(60);
  });

  it("keeps canonical explanations deterministic when model services are unavailable", async () => {
    const loaded = makeLoadedAuditContext();
    const complete = vi.fn(async () => {
      throw Object.assign(new Error("capacity unavailable"), { status: 503 });
    });
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      complete,
    });

    const response = await handler(
      request({
        messages: [
          { role: "user", content: "Why did Conversion get that score?" },
        ],
        activeReportId: REPORT_ID,
      })
    );
    const payload = await response.json();

    expect(complete).not.toHaveBeenCalled();
    expect(payload.message).toContain("Conversion was one of the weakest areas");
    expect(payload.message).not.toContain("60");
    expect(payload.auditQa.citations).toMatchObject([
      { sourceId: "S2", url: "https://example.com/pricing" },
    ]);
  });

  it("keeps unrelated conversation on the existing DeepSeek path", async () => {
    const complete = vi.fn(async () => ({
      content: "I focus on startup growth investigations.",
      toolCalls: [],
    }));
    const loadContext = vi.fn();
    const handler = createConversationHandler({ complete, loadContext });
    const response = await handler(
      request({
        messages: [{ role: "user", content: "tell me a joke" }],
        activeReportId: REPORT_ID,
      })
    );

    expect(await response.json()).toEqual({
      action: "respond",
      message: "I focus on startup growth investigations.",
      url: null,
    });
    expect(complete).toHaveBeenCalledOnce();
    expect(loadContext).not.toHaveBeenCalled();
  });

  it("keeps the existing new-URL audit tool flow unchanged", async () => {
    const complete = vi.fn(async () => ({
      content: null,
      toolCalls: [
        {
          name: "start_startup_audit",
          arguments: JSON.stringify({ url: "https://linear.app" }),
        },
      ],
    }));
    const handler = createConversationHandler({ complete });
    const response = await handler(
      request({
        messages: [
          { role: "user", content: "Audit https://linear.app for me" },
        ],
        activeReportId: REPORT_ID,
      })
    );

    expect(await response.json()).toEqual({
      action: "start_audit",
      message: "",
      url: "https://linear.app/",
    });
  });

  it("blocks a new audit action when the visitor has used all free audits", async () => {
    const complete = vi.fn(async () => ({
      content: null,
      toolCalls: [
        {
          name: "start_startup_audit",
          arguments: JSON.stringify({ url: "https://stripe.com" }),
        },
      ],
    }));
    const getNewAuditUsage = vi.fn(async () => ({
      usage: {
        free: {
          limit: 3,
          used: 3,
          remaining: 0,
          nextAvailableAt: "2026-08-04T10:00:00.000Z",
        },
        paid: { available: 0 },
        canStartAudit: false,
      },
    }));
    const handler = createConversationHandler({ complete, getNewAuditUsage });

    const response = await handler(
      request({
        messages: [
          { role: "user", content: "Audit https://stripe.com" },
        ],
      })
    );
    const payload = await response.json();

    expect(payload).toMatchObject({
      action: "payment_required",
      url: "https://stripe.com/",
      quota: { used: 3, remaining: 0 },
    });
  });

  it("allows a new audit action when paid access is available", async () => {
    const complete = vi.fn(async () => ({
      content: null,
      toolCalls: [
        {
          name: "start_startup_audit",
          arguments: JSON.stringify({ url: "https://stripe.com" }),
        },
      ],
    }));
    const handler = createConversationHandler({
      complete,
      getNewAuditUsage: async () => ({
        usage: {
          free: {
            limit: 3,
            used: 3,
            remaining: 0,
            nextAvailableAt: "2026-08-31T10:00:00.000Z",
          },
          paid: { available: 1 },
          canStartAudit: true,
        },
      }),
    });

    expect(
      await (
        await handler(
          request({
            messages: [{ role: "user", content: "Audit https://stripe.com" }],
          })
        )
      ).json()
    ).toMatchObject({
      action: "start_audit",
      usage: { paid: { available: 1 }, canStartAudit: true },
    });
  });

  it("allows audit follow-up Q&A when the visitor is at 3/3", async () => {
    const loaded = makeLoadedAuditContext();
    const getNewAuditUsage = vi.fn();
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      getNewAuditUsage,
    });

    const response = await handler(
      request({
        messages: [{ role: "user", content: "Why did Conversion score 60?" }],
        activeReportId: REPORT_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(getNewAuditUsage).not.toHaveBeenCalled();
  });

  it("allows general conversation when the visitor is at 3/3", async () => {
    const complete = vi.fn(async () => ({
      content: "I can explain the audit framework.",
      toolCalls: [],
    }));
    const getNewAuditUsage = vi.fn();
    const handler = createConversationHandler({ complete, getNewAuditUsage });

    const response = await handler(
      request({ messages: [{ role: "user", content: "What can you do?" }] })
    );

    expect(await response.json()).toMatchObject({ action: "respond" });
    expect(getNewAuditUsage).not.toHaveBeenCalled();
  });

  it("handles a missing active report without either model", async () => {
    const complete = vi.fn();
    const handler = createConversationHandler({ complete });
    const response = await handler(
      request({ messages: [{ role: "user", content: "Why did it score 69?" }] })
    );
    const payload = await response.json();

    expect(payload.message).toContain("active completed investigation");
    expect(complete).not.toHaveBeenCalled();
  });

  it("answers source existence and counterfactuals with zero Gemini calls", async () => {
    const loaded = makeLoadedAuditContext();
    const complete = vi.fn();
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      complete,
    });

    const sourceResponse = await handler(
      request({
        messages: [
          { role: "user", content: "Did you inspect their pricing page?" },
        ],
        activeReportId: REPORT_ID,
      })
    );
    const counterfactualResponse = await handler(
      request({
        messages: [
          {
            role: "user",
            content: "What would the overall score be if Conversion were 90?",
          },
        ],
        activeReportId: REPORT_ID,
      })
    );

    const sourcePayload = await sourceResponse.json();
    expect(sourcePayload.message).toContain("/pricing as inspected");
    expect(sourcePayload.message).not.toContain("S2");
    expect((await counterfactualResponse.json()).message).toContain("73/100");
    expect(complete).not.toHaveBeenCalled();
  });

  it("does not let a named recent override the report currently selected", async () => {
    const secondId = "22222222-2222-4222-8222-222222222222";
    const acme = makeLoadedAuditContext();
    acme.reportId = secondId;
    acme.context.reportId = secondId;
    acme.context.companyIdentity.company_name = "Acme";
    const active = makeLoadedAuditContext();
    const loadContext = vi.fn(async (reportId: string) =>
      reportId === REPORT_ID ? active : acme
    );
    const handler = createConversationHandler({ loadContext });
    await handler(
      request({
        messages: [
          { role: "user", content: "Why was Acme's Trust score low?" },
        ],
        activeReportId: REPORT_ID,
        knownAudits: [
          {
            reportId: REPORT_ID,
            companyName: "Example",
            domain: "example.com",
          },
          {
            reportId: secondId,
            companyName: "Acme",
            domain: "acme.example",
          },
        ],
      })
    );

    expect(loadContext).toHaveBeenCalledWith(REPORT_ID);
  });

  it("binds every switched follow-up to the exact active persisted report", async () => {
    const ids = {
      morpho: "33333333-3333-4333-8333-333333333333",
      linear: "44444444-4444-4444-8444-444444444444",
      solana: "55555555-5555-4555-8555-555555555555",
    };
    const makeReport = (
      reportId: string,
      company: string,
      strongest: "positioning" | "trust" | "conversion",
      weakest: "growth_foundation" | "messaging"
    ) => {
      const loaded = makeLoadedAuditContext();
      loaded.reportId = reportId;
      loaded.context.reportId = reportId;
      loaded.context.companyIdentity.company_name = company;
      for (const pillar of Object.values(loaded.context.pillars)) {
        pillar.score = 70;
      }
      loaded.context.pillars[strongest].score = 95;
      loaded.context.pillars[weakest].score = 40;
      return loaded;
    };
    const reports = new Map([
      [ids.morpho, makeReport(ids.morpho, "Morpho", "trust", "messaging")],
      [ids.linear, makeReport(ids.linear, "Linear", "positioning", "growth_foundation")],
      [ids.solana, makeReport(ids.solana, "Solana", "conversion", "messaging")],
    ]);
    const loadContext = vi.fn(async (reportId: string) => reports.get(reportId) ?? null);
    const handler = createConversationHandler({ loadContext });
    const ask = async (activeReportId: string, content: string) =>
      (
        await (
          await handler(
            request({ messages: [{ role: "user", content }], activeReportId })
          )
        ).json()
      ).message as string;

    expect(await ask(ids.morpho, "What is the strongest pillar?")).toContain(
      "Trust"
    );
    expect(await ask(ids.linear, "What is the weakest pillar?")).toContain(
      "Growth Foundation"
    );
    expect(await ask(ids.solana, "What is the strongest pillar?")).toContain(
      "Conversion"
    );
    const linearAgain = await ask(ids.linear, "What is the strongest pillar?");
    expect(linearAgain).toContain("Positioning");
    expect(linearAgain).not.toContain("Trust");
    expect(loadContext.mock.calls.map(([reportId]) => reportId)).toEqual([
      ids.morpho,
      ids.linear,
      ids.solana,
      ids.linear,
    ]);
  });

  it("does not answer an explicit company reference from the wrong context", async () => {
    const handler = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
    });
    const response = await handler(
      request({
        messages: [
          { role: "user", content: "Why was Acme's Trust score low?" },
        ],
        activeReportId: REPORT_ID,
      })
    );
    const payload = await response.json();

    expect(payload.message).toContain("does not match the active investigation");
  });

  it("returns structured future-action limitations without scraping", async () => {
    const handler = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
    });
    const response = await handler(
      request({
        messages: [
          {
            role: "user",
            content: "Can you inspect their security page too?",
          },
        ],
        activeReportId: REPORT_ID,
      })
    );
    const payload = await response.json();

    expect(payload.auditQa.answerType).toBe("research_extension");
    expect(payload.auditQa.limitations).toContain("No new page was fetched.");
  });

  it("does not import audit execution or acquisition into follow-up Q&A", () => {
    const source = [
      "src/app/api/conversation/route.ts",
      "src/lib/conversation/auditQa.ts",
      "src/lib/conversation/auditQuestions.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/runVerdictAudit|gatherAuditEvidence|fetchContext|Firecrawl/i);
  });
});
