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
import type { HumanAuditReservedAccess } from "@/lib/humanAuditAccess";
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
      reserveAccess: async (identity: string) => {
        const free = await canStartHumanAudit(identity, {
          store,
          nowMs,
          generateToken: () => `reservation-${auditNumber + 1}`,
        });
        return free.allowed
          ? {
              allowed: true as const,
              access: {
                accessType: "free" as const,
                reservationToken: free.reservationToken,
              },
              usage: {
                free: free.quota,
                paid: { available: 0 },
                canStartAudit: true,
              },
            }
          : {
              allowed: false as const,
              reason: "payment_required" as const,
              usage: {
                free: free.quota,
                paid: { available: 0 },
                canStartAudit: false,
              },
            };
      },
      completeAccess: async (
        identity: string,
        access: HumanAuditReservedAccess,
        reportId: string | undefined
      ) => {
        if (access.accessType !== "free") throw new Error("expected free access");
        const free = await recordSuccessfulHumanAudit(
          identity,
          access.reservationToken,
          reportId,
          { store, nowMs }
        );
        nowMs += 1_000;
        return {
          free,
          paid: { available: 0 },
          canStartAudit: free.remaining > 0,
        };
      },
      releaseAccess: async (
        identity: string,
        access: HumanAuditReservedAccess
      ) => {
        if (access.accessType === "free") {
          await releaseHumanAuditReservation(
            identity,
            access.reservationToken,
            { store, nowMs }
          );
        }
      },
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
      error: "HUMAN_AUDIT_PAYMENT_REQUIRED",
      quota: { used: 3, remaining: 0 },
    });
    expect(runAudit).toHaveBeenCalledTimes(3);

    const getNewAuditUsage = vi.fn(async () => ({
      usage: {
        free: await getHumanAuditQuota(VISITOR, { store, nowMs }),
        paid: { available: 0 },
        canStartAudit: false,
      },
    }));
    const followup = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
      getNewAuditUsage,
    });
    const followupResponse = await followup(
      conversationRequest("Did you inspect the pricing page?", REPORT_ID)
    );
    expect(followupResponse.status).toBe(200);
    const followupPayload = await followupResponse.json();
    expect(followupPayload.message).toContain("/pricing as inspected");
    expect(followupPayload.message).not.toContain("S2");

    const complete = vi.fn(async () => ({
      content: "General conversation remains available.",
      toolCalls: [],
    }));
    const general = createConversationHandler({ complete, getNewAuditUsage });
    expect(
      await (await general(conversationRequest("hello"))).json()
    ).toMatchObject({ message: "General conversation remains available." });
    expect(getNewAuditUsage).not.toHaveBeenCalled();
  });
});
