import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInvestigateHandler } from "./investigate/route";
import { createConversationHandler } from "../conversation/route";
import {
  MemoryHumanAuditQuotaStore,
  canStartHumanAudit,
  getHumanAuditQuota,
  recordSuccessfulHumanAudit,
  releaseHumanAuditReservation,
} from "@/lib/humanAuditQuota";
import { makeLoadedAuditContext } from "@/lib/conversation/__testutils__/auditContext";

const VISITOR = "local-smoke-visitor";
const REPORT_ID = "11111111-1111-4111-8111-111111111111";

function auditRequest(url: string): Request {
  return new Request("http://localhost/api/engine/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

function conversationRequest(content: string, activeReportId?: string): Request {
  return new Request("http://localhost/api/conversation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content }],
      activeReportId,
    }),
  });
}

describe("mock-backed human quota product flow", () => {
  it("allows three successes, blocks the fourth, and leaves conversation available", async () => {
    const store = new MemoryHumanAuditQuotaStore();
    let nowMs = Date.UTC(2026, 7, 3, 10, 0, 0);
    let auditNumber = 0;
    const runAudit = vi.fn(async () => {
      auditNumber += 1;
      return { reportId: `report-${auditNumber}` };
    });
    const handler = createInvestigateHandler({
      resolveVisitor: () => ({ quotaIdentity: VISITOR }),
      checkAbuse: async () => ({ allowed: true }),
      reserveQuota: (identity) =>
        canStartHumanAudit(identity, {
          store,
          nowMs,
          generateToken: () => `reservation-${auditNumber + 1}`,
        }),
      commitQuota: async (identity, token, reportId) => {
        const quota = await recordSuccessfulHumanAudit(
          identity,
          token,
          reportId,
          { store, nowMs }
        );
        nowMs += 1_000;
        return quota;
      },
      releaseQuota: (identity, token) =>
        releaseHumanAuditReservation(identity, token, { store, nowMs }),
      runAudit: runAudit as never,
      summarize: () => ({ overallScore: 80 }),
    });

    const initial = await getHumanAuditQuota(VISITOR, { store, nowMs });
    expect(initial).toMatchObject({ used: 0, remaining: 3 });

    for (const expectedRemaining of [2, 1, 0]) {
      const response = await handler(
        auditRequest(`https://startup-${expectedRemaining}.example`)
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(
        `\"remaining\":${expectedRemaining}`
      );
    }

    const fourth = await handler(auditRequest("https://fourth.example"));
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toMatchObject({
      error: "HUMAN_AUDIT_QUOTA_EXHAUSTED",
      quota: { used: 3, remaining: 0 },
    });
    expect(runAudit).toHaveBeenCalledTimes(3);

    const getNewAuditQuota = vi.fn(async () => ({
      quota: await getHumanAuditQuota(VISITOR, { store, nowMs }),
    }));
    const followup = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
      getNewAuditQuota,
    });
    const followupResponse = await followup(
      conversationRequest("Did you inspect the pricing page?", REPORT_ID)
    );
    expect(followupResponse.status).toBe(200);
    expect((await followupResponse.json()).message).toContain("/pricing [S2]");

    const complete = vi.fn(async () => ({
      content: "General conversation remains available.",
      toolCalls: [],
    }));
    const general = createConversationHandler({ complete, getNewAuditQuota });
    expect(
      await (await general(conversationRequest("hello"))).json()
    ).toMatchObject({ message: "General conversation remains available." });
    expect(getNewAuditQuota).not.toHaveBeenCalled();
  });
});
