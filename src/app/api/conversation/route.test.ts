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

import { createConversationHandler } from "./route";
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
  it("routes an active-report follow-up to authoritative audit Q&A", async () => {
    const loaded = makeLoadedAuditContext();
    const loadContext = vi.fn(async () => loaded);
    const answerGrounded = vi.fn(async (input) => {
      expect(input.loaded.context.companyIdentity.company_name).toBe("Example");
      return {
        answer: "Conversion reflects the inspected pricing evidence. [S2]",
        citations: ["S2" as const],
        answerType: "score_explanation" as const,
        confidence: "high" as const,
        limitations: [],
      };
    });
    const complete = vi.fn();
    const handler = createConversationHandler({
      loadContext,
      answerGrounded,
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
    expect(answerGrounded).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
    expect(JSON.stringify(payload)).not.toContain("FABRICATED CLIENT CONTEXT");
    expect(payload).toMatchObject({
      action: "respond",
      auditQa: {
        answerType: "score_explanation",
        citations: [
          {
            sourceId: "S2",
            url: "https://example.com/pricing",
          },
        ],
      },
    });
  });

  it("falls back to stored pillar fields when the one Gemini call fails", async () => {
    const loaded = makeLoadedAuditContext();
    const answerGrounded = vi.fn(async () => {
      throw new Error("MODEL_UNAVAILABLE");
    });
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      answerGrounded,
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

    expect(answerGrounded).toHaveBeenCalledOnce();
    expect(payload.message).toContain("Conversion scored **60/100**");
    expect(payload.auditQa).toMatchObject({
      answerType: "score_explanation",
      citations: [],
    });
    expect(loaded.context.pillars.conversion.score).toBe(60);
  });

  it("uses deterministic Q&A only after both bounded model paths are unavailable", async () => {
    const loaded = makeLoadedAuditContext();
    const qaGenerator = vi.fn(async (_request: { model: string }) => {
      throw Object.assign(new Error("capacity unavailable"), { status: 503 });
    });
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      qaGenerator,
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

    expect(qaGenerator.mock.calls.map(([request]) => request.model)).toEqual([
      "gemini-3.7-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
    ]);
    expect(payload.message).toContain("Conversion scored **60/100**");
    expect(payload.auditQa.citations).toEqual([]);
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
      url: null,
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
    const answerGrounded = vi.fn(async () => ({
      answer: "Conversion is constrained by the pricing evidence. [S2]",
      citations: ["S2" as const],
      answerType: "score_explanation" as const,
      confidence: "high" as const,
      limitations: [],
    }));
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      answerGrounded,
      getNewAuditUsage,
    });

    const response = await handler(
      request({
        messages: [{ role: "user", content: "Why did Conversion score 60?" }],
        activeReportId: REPORT_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(answerGrounded).toHaveBeenCalledOnce();
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
    const answerGrounded = vi.fn();
    const handler = createConversationHandler({ complete, answerGrounded });
    const response = await handler(
      request({ messages: [{ role: "user", content: "Why did it score 69?" }] })
    );
    const payload = await response.json();

    expect(payload.message).toContain("active completed investigation");
    expect(complete).not.toHaveBeenCalled();
    expect(answerGrounded).not.toHaveBeenCalled();
  });

  it("answers source existence and counterfactuals with zero Gemini calls", async () => {
    const loaded = makeLoadedAuditContext();
    const answerGrounded = vi.fn();
    const complete = vi.fn();
    const handler = createConversationHandler({
      loadContext: async () => loaded,
      answerGrounded,
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

    expect((await sourceResponse.json()).message).toContain("/pricing [S2]");
    expect((await counterfactualResponse.json()).message).toContain("73/100");
    expect(answerGrounded).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("resolves an explicit known company to its server-loaded report", async () => {
    const secondId = "22222222-2222-4222-8222-222222222222";
    const acme = makeLoadedAuditContext();
    acme.reportId = secondId;
    acme.context.reportId = secondId;
    acme.context.companyIdentity.company_name = "Acme";
    const loadContext = vi.fn(async () => acme);
    const answerGrounded = vi.fn(async () => ({
      answer: "Grounded answer.",
      citations: [],
      answerType: "score_explanation" as const,
      confidence: "medium" as const,
      limitations: [],
    }));
    const handler = createConversationHandler({ loadContext, answerGrounded });
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

    expect(loadContext).toHaveBeenCalledWith(secondId);
  });

  it("does not answer an explicit company reference from the wrong context", async () => {
    const answerGrounded = vi.fn();
    const handler = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
      answerGrounded,
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
    expect(answerGrounded).not.toHaveBeenCalled();
  });

  it("returns structured future-action limitations without scraping", async () => {
    const answerGrounded = vi.fn();
    const handler = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
      answerGrounded,
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
    expect(answerGrounded).not.toHaveBeenCalled();
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
