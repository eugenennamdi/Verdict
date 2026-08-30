import { describe, expect, it, vi } from "vitest";
import {
  completeHumanAuditAccess,
  releaseHumanAuditAccess,
  reserveHumanAuditAccess,
} from "./humanAuditAccess";

const FREE_EXHAUSTED = {
  limit: 3,
  used: 3,
  remaining: 0,
  nextAvailableAt: "2026-08-31T10:00:00.000Z",
};

describe("human audit access selection", () => {
  it("always prefers an available free slot over paid access", async () => {
    const reservePaid = vi.fn();
    const decision = await reserveHumanAuditAccess("visitor", {
      reserveFree: async () => ({
        allowed: true,
        accessType: "free",
        reservationToken: "free-token",
        quota: { ...FREE_EXHAUSTED, used: 2, remaining: 0 },
      }),
      getPaid: async () => 1,
      reservePaid,
    });

    expect(decision).toMatchObject({
      allowed: true,
      access: { accessType: "free", reservationToken: "free-token" },
      usage: { paid: { available: 1 } },
    });
    expect(reservePaid).not.toHaveBeenCalled();
  });

  it("reserves paid access only after free quota is exhausted", async () => {
    const decision = await reserveHumanAuditAccess("visitor", {
      reserveFree: async () => ({
        allowed: false,
        reason: "quota_exhausted",
        quota: FREE_EXHAUSTED,
      }),
      reservePaid: async () => ({
        entitlementId: "entitlement-1",
        reservationToken: "paid-token",
      }),
      getPaid: async () => 0,
    });

    expect(decision).toMatchObject({
      allowed: true,
      access: {
        accessType: "paid",
        entitlement: { entitlementId: "entitlement-1" },
      },
    });
  });

  it("consumes paid access on success and releases it on failure", async () => {
    const entitlement = {
      entitlementId: "entitlement-1",
      reservationToken: "paid-token",
    };
    const consumePaid = vi.fn(async () => undefined);
    const releasePaid = vi.fn(async () => undefined);
    const access = { accessType: "paid" as const, entitlement };

    await completeHumanAuditAccess("visitor", access, "report-1", {
      consumePaid,
      getFree: async () => FREE_EXHAUSTED,
      getPaid: async () => 0,
    });
    await releaseHumanAuditAccess("visitor", access, { releasePaid });

    expect(consumePaid).toHaveBeenCalledWith(
      "visitor",
      entitlement,
      "report-1"
    );
    expect(releasePaid).toHaveBeenCalledWith("visitor", entitlement);
  });
});
