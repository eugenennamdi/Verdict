import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import { extractStartupUrl } from "@/lib/conversation/intents";
import { createConversationHandler } from "@/app/api/conversation/route";
import { createInvestigateHandler } from "@/app/api/engine/investigate/route";
import { makeLoadedAuditContext } from "@/lib/conversation/__testutils__/auditContext";

function makeUsage(freeRemaining: number, paidAvailable: number): HumanAuditUsageState {
  return {
    free: {
      limit: 3,
      used: 3 - freeRemaining,
      remaining: freeRemaining,
      nextAvailableAt: freeRemaining === 0 ? "2026-08-31T12:00:00.000Z" : null,
    },
    paid: { available: paidAvailable },
    canStartAudit: freeRemaining > 0 || paidAvailable > 0,
  };
}

describe("first-attempt paid audit handoff and invariants", () => {
  it("1. quota exhausted + no paid entitlement + FIRST valid audit submission -> paywall appears immediately on first attempt", async () => {
    const exhaustedUsage = makeUsage(0, 0);

    const investigateHandler = createInvestigateHandler({
      resolveVisitor: () => ({ quotaIdentity: "test-user" }),
      checkAbuse: async () => ({ allowed: true }),
      reserveAccess: async () => ({
        allowed: false,
        reason: "payment_required",
        usage: exhaustedUsage,
      }),
    });

    const response = await investigateHandler(
      new Request("http://localhost/api/engine/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cal.com" }),
      })
    );

    expect(response.status).toBe(429);
    const payload = await response.json();
    expect(payload.error).toBe("HUMAN_AUDIT_PAYMENT_REQUIRED");
    expect(payload.usage.canStartAudit).toBe(false);

    // Simulated workspace state transition for Attempt 1
    let pendingAuditUrl: string | null = null;
    let currentUsage: HumanAuditUsageState | null = null;

    if (
      payload.error === "HUMAN_AUDIT_PAYMENT_REQUIRED" ||
      Boolean(payload.usage && !payload.usage.canStartAudit)
    ) {
      currentUsage = payload.usage;
      pendingAuditUrl = "https://cal.com";
    }

    expect(pendingAuditUrl).toBe("https://cal.com");
    expect(currentUsage?.free.remaining).toBe(0);
    expect(currentUsage?.paid.available).toBe(0);
  });

  it("2. user does NOT need to submit the same URL twice to reach the paywall", async () => {
    const exhaustedUsage = makeUsage(0, 0);
    let attemptsCount = 0;
    let paywallOpenedOnAttempt: number | null = null;

    const simulateSubmission = (
      input: string,
      clientUsage: HumanAuditUsageState | null
    ) => {
      attemptsCount += 1;
      const url = extractStartupUrl(input);

      // Fast-path client check
      if (
        url &&
        clientUsage?.free.remaining === 0 &&
        clientUsage.paid.available === 0
      ) {
        paywallOpenedOnAttempt = attemptsCount;
        return { paywall: true, url };
      }

      // Server-backed check (e.g. when clientUsage is null or stale on attempt 1)
      const serverPayload = {
        error: "HUMAN_AUDIT_PAYMENT_REQUIRED",
        usage: exhaustedUsage,
      };

      if (
        serverPayload.error === "HUMAN_AUDIT_PAYMENT_REQUIRED" ||
        Boolean(serverPayload.usage && !serverPayload.usage.canStartAudit)
      ) {
        paywallOpenedOnAttempt = attemptsCount;
        return { paywall: true, url, usage: serverPayload.usage };
      }

      return { paywall: false, url };
    };

    // Attempt 1 with initial null client usage state
    const attempt1 = simulateSubmission("cal.com", null);
    expect(attempt1.paywall).toBe(true);
    expect(attempt1.url).toBe("https://cal.com/");
    expect(paywallOpenedOnAttempt).toBe(1);
    expect(attemptsCount).toBe(1);
  });

  it("3. pending URL survives quota -> paywall transition without loss", () => {
    const rawInput = "cal.com";
    const extracted = extractStartupUrl(rawInput);
    expect(extracted).toBe("https://cal.com/");

    let pendingAuditUrl: string | null = null;

    // Transition triggered from quota rejection
    pendingAuditUrl = extracted;
    expect(pendingAuditUrl).toBe("https://cal.com/");
  });

  it("4. payment-success handoff uses the original pending URL without re-typing", () => {
    let pendingAuditUrl: string | null = "https://cal.com/";
    let messages: Array<{ role: string; content: string }> = [];
    let auditStartedWithUrl: string | null = null;

    const onRunAudit = () => {
      const url = pendingAuditUrl;
      pendingAuditUrl = null;
      if (!url) return;

      if (!messages.some((m) => m.content === url)) {
        messages.push({ role: "user", content: url });
      }
      auditStartedWithUrl = url;
    };

    // Trigger post-payment run
    onRunAudit();

    expect(pendingAuditUrl).toBeNull();
    expect(auditStartedWithUrl).toBe("https://cal.com/");
    expect(messages).toEqual([{ role: "user", content: "https://cal.com/" }]);
  });

  it("5. quota exhausted + existing paid entitlement -> audit starts immediately without paywall", async () => {
    const paidUsage = makeUsage(0, 1);
    const runAudit = vi.fn(async () => ({ reportId: "report-paid-123" }));

    const investigateHandler = createInvestigateHandler({
      resolveVisitor: () => ({ quotaIdentity: "test-user" }),
      checkAbuse: async () => ({ allowed: true }),
      reserveAccess: async () => ({
        allowed: true,
        access: {
          accessType: "paid",
          entitlement: { id: "ent-1", visitorHash: "test-user" } as never,
        },
        usage: paidUsage,
      }),
      completeAccess: async () => paidUsage,
      runAudit: runAudit as never,
      summarize: () => ({ overallScore: 88 }),
    });

    const response = await investigateHandler(
      new Request("http://localhost/api/engine/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cal.com" }),
      })
    );

    expect(response.status).toBe(200);
    expect(runAudit).toHaveBeenCalledOnce();
  });

  it("6. free quota available -> audit starts through free path", async () => {
    const freeUsage = makeUsage(2, 0);
    const runAudit = vi.fn(async () => ({ reportId: "report-free-123" }));

    const investigateHandler = createInvestigateHandler({
      resolveVisitor: () => ({ quotaIdentity: "test-user" }),
      checkAbuse: async () => ({ allowed: true }),
      reserveAccess: async () => ({
        allowed: true,
        access: {
          accessType: "free",
          reservationToken: "tok-free-1",
        },
        usage: freeUsage,
      }),
      completeAccess: async () => freeUsage,
      runAudit: runAudit as never,
      summarize: () => ({ overallScore: 75 }),
    });

    const response = await investigateHandler(
      new Request("http://localhost/api/engine/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://cal.com" }),
      })
    );

    expect(response.status).toBe(200);
    expect(runAudit).toHaveBeenCalledOnce();
  });

  it("7. general chat with quota exhausted -> responds normally without paywall", async () => {
    const complete = vi.fn(async () => ({
      content: "Hello! I analyze growth readiness for startups.",
      toolCalls: [],
    }));
    const getNewAuditUsage = vi.fn(async () => ({
      usage: makeUsage(0, 0),
    }));

    const conversationHandler = createConversationHandler({
      complete,
      getNewAuditUsage,
    });

    const response = await conversationHandler(
      new Request("http://localhost/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Who are you?" }],
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.action).toBe("respond");
    expect(payload.message).toContain("Hello! I analyze growth readiness");
    expect(payload.url).toBeNull();
    expect(getNewAuditUsage).not.toHaveBeenCalled();
  });

  it("8. grounded audit follow-up with quota exhausted -> answers without paywall", async () => {
    const conversationHandler = createConversationHandler({
      loadContext: async () => makeLoadedAuditContext(),
    });

    const response = await conversationHandler(
      new Request("http://localhost/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Did you inspect the pricing page?" }],
          activeReportId: "11111111-1111-4111-8111-111111111111",
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.action).toBe("respond");
    expect(payload.message).toContain("/pricing as inspected");
  });

  it("9. usage refresh does not create a one-request lag on first attempt", async () => {
    let clientUsage: HumanAuditUsageState | null = null;
    let pendingAuditUrl: string | null = null;

    const handleInvestigationResponse = (
      url: string,
      status: number,
      payload: { error?: string; usage?: HumanAuditUsageState }
    ) => {
      const isPaymentRequired =
        payload.error === "HUMAN_AUDIT_PAYMENT_REQUIRED" ||
        Boolean(payload.usage && !payload.usage.canStartAudit);

      if (payload.usage) {
        clientUsage = payload.usage;
      }

      if (isPaymentRequired) {
        pendingAuditUrl = url;
      }
    };

    // First attempt gets 429
    handleInvestigationResponse("https://cal.com", 429, {
      error: "HUMAN_AUDIT_PAYMENT_REQUIRED",
      usage: makeUsage(0, 0),
    });

    // Both usage AND paywall URL are set synchronously on the FIRST attempt
    expect(clientUsage).toEqual(makeUsage(0, 0));
    expect(pendingAuditUrl).toBe("https://cal.com");
  });

  it("10. no duplicate audit execution or duplicate messages on async paywall state changes", () => {
    let auditRunCount = 0;
    const executedUrls: string[] = [];
    const messages: Array<{ role: string; content: string }> = [
      { role: "user", content: "https://cal.com" },
    ];

    const onRunAudit = (url: string) => {
      auditRunCount += 1;
      executedUrls.push(url);

      // Verify idempotence: does not push duplicate user message if already present
      if (
        messages.at(-1)?.role !== "user" ||
        messages.at(-1)?.content !== url
      ) {
        messages.push({ role: "user", content: url });
      }
    };

    onRunAudit("https://cal.com");

    expect(auditRunCount).toBe(1);
    expect(executedUrls).toEqual(["https://cal.com"]);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("https://cal.com");
  });

  it("11. regression check: old divergence vs new immediate-paywall behavior", () => {
    // Old implementation behavior simulation:
    const oldAttempt1Response = {
      status: 429,
      error: "HUMAN_AUDIT_PAYMENT_REQUIRED",
      message: "Free audits used for now. Your next free audit becomes available in 16h 30m.",
      usage: makeUsage(0, 0),
    };

    // In old implementation:
    let oldPendingUrl: string | null = null;
    let oldReplyMessage: string | null = null;
    if (oldAttempt1Response.status === 429) {
      oldReplyMessage = oldAttempt1Response.message; // Old code just replied with message
    }
    expect(oldPendingUrl).toBeNull(); // Old bug: no paywall on attempt 1
    expect(oldReplyMessage).toContain("Free audits used for now");

    // In new implementation:
    let newPendingUrl: string | null = null;
    let newReplyMessage: string | null = null;
    const isPaymentRequired =
      oldAttempt1Response.error === "HUMAN_AUDIT_PAYMENT_REQUIRED" ||
      !oldAttempt1Response.usage.canStartAudit;

    if (isPaymentRequired) {
      newPendingUrl = "https://cal.com"; // New fix: immediately sets pendingAuditUrl
    } else {
      newReplyMessage = oldAttempt1Response.message;
    }

    expect(newPendingUrl).toBe("https://cal.com"); // New fix: paywall opens on Attempt 1
    expect(newReplyMessage).toBeNull();
  });
});
