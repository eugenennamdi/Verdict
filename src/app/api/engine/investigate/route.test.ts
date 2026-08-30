import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createInvestigateHandler } from "./route";
import type { HumanAuditAccessDecision } from "@/lib/humanAuditAccess";
import { ModelAvailabilityError } from "@/lib/audit/model";
import { MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE } from "@/lib/audit/publicError";

const AVAILABLE = {
  allowed: true as const,
  access: {
    accessType: "free" as const,
    reservationToken: "reservation-token",
  },
  usage: {
    free: { limit: 3, used: 0, remaining: 2, nextAvailableAt: null },
    paid: { available: 0 },
    canStartAudit: true,
  },
};
const AFTER_SUCCESS = {
  free: { limit: 3, used: 1, remaining: 2, nextAvailableAt: null },
  paid: { available: 0 },
  canStartAudit: true,
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/engine/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseDependencies() {
  const reserveAccess = vi.fn(
    async (): Promise<HumanAuditAccessDecision> => AVAILABLE
  );
  return {
    resolveVisitor: () => ({
      quotaIdentity: "visitor-hash",
      setCookieHeader:
        "verdict_anonymous_visitor=signed; Path=/; HttpOnly; SameSite=Lax",
    }),
    checkAbuse: vi.fn(async () => ({ allowed: true })),
    reserveAccess,
    completeAccess: vi.fn(async () => AFTER_SUCCESS),
    releaseAccess: vi.fn(async () => undefined),
    summarize: vi.fn(() => ({ overallScore: 80, reportId: "report-1" })),
  };
}

describe("POST /api/engine/investigate human quota", () => {
  it("commits one slot only after a successful audit and returns updated quota", async () => {
    const dependencies = baseDependencies();
    const runAudit = vi.fn(async () => ({ reportId: "report-1" }));
    const handler = createInvestigateHandler({
      ...dependencies,
      runAudit: runAudit as never,
    });

    const response = await handler(request({ url: "https://example.com" }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(runAudit).toHaveBeenCalledOnce();
    expect(dependencies.completeAccess).toHaveBeenCalledWith(
      "visitor-hash",
      AVAILABLE.access,
      "report-1"
    );
    expect(dependencies.releaseAccess).not.toHaveBeenCalled();
    expect(body).toContain('"humanAuditQuota":{"limit":3,"used":1,"remaining":2');
  });

  it("consumes one reserved paid entitlement after a successful audit", async () => {
    const dependencies = baseDependencies();
    const paidAccess = {
      allowed: true as const,
      access: {
        accessType: "paid" as const,
        entitlement: {
          entitlementId: "entitlement-1",
          reservationToken: "paid-token",
        },
      },
      usage: {
        free: { limit: 3, used: 3, remaining: 0, nextAvailableAt: null },
        paid: { available: 0 },
        canStartAudit: true,
      },
    };
    dependencies.reserveAccess.mockResolvedValue(paidAccess);
    dependencies.completeAccess.mockResolvedValue({
      free: paidAccess.usage.free,
      paid: { available: 0 },
      canStartAudit: false,
    });
    const handler = createInvestigateHandler({
      ...dependencies,
      runAudit: vi.fn(async () => ({ reportId: "paid-report" })) as never,
    });

    const response = await handler(request({ url: "https://example.com" }));
    await response.text();

    expect(dependencies.completeAccess).toHaveBeenCalledWith(
      "visitor-hash",
      paidAccess.access,
      "paid-report"
    );
    expect(dependencies.releaseAccess).not.toHaveBeenCalled();
  });

  it("blocks the fourth new audit before engine execution", async () => {
    const dependencies = baseDependencies();
    const reserveAccess = vi.fn(async () => ({
      allowed: false as const,
      reason: "payment_required" as const,
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
    const runAudit = vi.fn();
    const handler = createInvestigateHandler({
      ...dependencies,
      reserveAccess,
      runAudit: runAudit as never,
    });

    const response = await handler(request({ url: "https://example.com" }));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({
      error: "HUMAN_AUDIT_PAYMENT_REQUIRED",
      quota: { used: 3, remaining: 0 },
      usage: { paid: { available: 0 }, canStartAudit: false },
    });
    expect(runAudit).not.toHaveBeenCalled();
    expect(dependencies.completeAccess).not.toHaveBeenCalled();
  });

  it("does not reserve quota for an invalid request body", async () => {
    const dependencies = baseDependencies();
    const handler = createInvestigateHandler(dependencies as never);
    const response = await handler(request({ visitorId: "client-forged" }));

    expect(response.status).toBe(400);
    expect(dependencies.reserveAccess).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid URL", Object.assign(new Error("Blocked URL"), { name: "UnsafeUrlError" })],
    ["scraping failure", new Error("SCRAPING_FAILED")],
    ["unexpected failure", new Error("UNEXPECTED")],
  ])("releases the reservation after %s", async (_label, failure) => {
    const dependencies = baseDependencies();
    const runAudit = vi.fn(async () => {
      throw failure;
    });
    const handler = createInvestigateHandler({
      ...dependencies,
      runAudit: runAudit as never,
    });

    const response = await handler(request({ url: "not-a-valid-url" }));
    await response.text();

    expect(dependencies.completeAccess).not.toHaveBeenCalled();
    expect(dependencies.releaseAccess).toHaveBeenCalledWith(
      "visitor-hash",
      AVAILABLE.access
    );
  });

  it("releases free access and returns only sanitized model-availability copy", async () => {
    const dependencies = baseDependencies();
    const handler = createInvestigateHandler({
      ...dependencies,
      runAudit: vi.fn(async () => {
        throw new ModelAvailabilityError("unavailable");
      }) as never,
    });

    const response = await handler(request({ url: "https://example.com" }));
    const body = await response.text();

    expect(dependencies.completeAccess).not.toHaveBeenCalled();
    expect(dependencies.releaseAccess).toHaveBeenCalledWith(
      "visitor-hash",
      AVAILABLE.access
    );
    expect(body).toContain(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE);
    expect(body).not.toMatch(
      /MODEL_HIGH_DEMAND|RESOURCE_EXHAUSTED|UNAVAILABLE|gemini|google/i
    );
  });

  it("releases a paid entitlement reservation when all model tiers are unavailable", async () => {
    const dependencies = baseDependencies();
    const paidAccess = {
      allowed: true as const,
      access: {
        accessType: "paid" as const,
        entitlement: {
          entitlementId: "entitlement-1",
          reservationToken: "paid-token",
        },
      },
      usage: {
        free: { limit: 3, used: 3, remaining: 0, nextAvailableAt: null },
        paid: { available: 0 },
        canStartAudit: true,
      },
    };
    dependencies.reserveAccess.mockResolvedValue(paidAccess);
    const handler = createInvestigateHandler({
      ...dependencies,
      runAudit: vi.fn(async () => {
        throw new ModelAvailabilityError("rate_limited");
      }) as never,
    });

    const response = await handler(request({ url: "https://example.com" }));
    await response.text();

    expect(dependencies.completeAccess).not.toHaveBeenCalled();
    expect(dependencies.releaseAccess).toHaveBeenCalledWith(
      "visitor-hash",
      paidAccess.access
    );
  });
});
