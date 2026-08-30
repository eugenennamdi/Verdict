import { describe, expect, it, vi } from "vitest";
import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import {
  HUMAN_PAID_AUDIT_RESERVATION_TTL_MS,
  MemoryHumanAuditEntitlementStore,
  RedisHumanAuditEntitlementStore,
  consumeHumanAuditEntitlement,
  getAvailableHumanAuditEntitlements,
  recordSettledHumanAuditEntitlement,
  releaseHumanAuditEntitlement,
  reserveHumanAuditEntitlement,
} from "./humanAuditEntitlement";

const START = Date.UTC(2026, 7, 30, 10, 0, 0);
const VISITOR = "visitor-a";
const OTHER_VISITOR = "visitor-b";
const REQUIREMENTS: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532",
  amount: "500000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1111111111111111111111111111111111111111",
  maxTimeoutSeconds: 60,
  extra: {},
};
const SETTLEMENT: SettleResponse = {
  success: true,
  transaction: `0x${"ab".repeat(32)}`,
  network: "eip155:84532",
  payer: "0x2222222222222222222222222222222222222222",
};

async function create(
  store: MemoryHumanAuditEntitlementStore,
  visitorHash = VISITOR
) {
  return recordSettledHumanAuditEntitlement(
    visitorHash,
    SETTLEMENT,
    REQUIREMENTS,
    { store, nowMs: START, generateId: () => "entitlement-1" }
  );
}

describe("human paid audit entitlements", () => {
  it("creates one available entitlement from a successful settlement", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    const result = await create(store);

    expect(result).toEqual({ entitlementId: "entitlement-1", created: true });
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, { store, nowMs: START })
    ).toBe(1);
    expect(store.readRecord("entitlement-1")).toMatchObject({
      visitorHash: VISITOR,
      status: "available",
      transaction: SETTLEMENT.transaction,
      amount: "500000",
      asset: REQUIREMENTS.asset,
    });
  });

  it("rejects mismatched settlement metadata", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    await expect(
      recordSettledHumanAuditEntitlement(
        VISITOR,
        { ...SETTLEMENT, amount: "1" },
        REQUIREMENTS,
        { store }
      )
    ).rejects.toThrow("metadata is invalid");
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, { store, nowMs: START })
    ).toBe(0);
  });

  it("is idempotent for the same canonical settled transaction", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    await create(store);
    const replay = await recordSettledHumanAuditEntitlement(
      VISITOR,
      SETTLEMENT,
      REQUIREMENTS,
      { store, nowMs: START + 1, generateId: () => "entitlement-replay" }
    );

    expect(replay).toEqual({ entitlementId: "entitlement-1", created: false });
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, { store, nowMs: START + 1 })
    ).toBe(1);
  });

  it("never transfers a replayed payment to another visitor", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    await create(store);
    await recordSettledHumanAuditEntitlement(
      OTHER_VISITOR,
      SETTLEMENT,
      REQUIREMENTS,
      { store, nowMs: START + 1, generateId: () => "forged-entitlement" }
    );

    expect(
      await getAvailableHumanAuditEntitlements(OTHER_VISITOR, {
        store,
        nowMs: START + 1,
      })
    ).toBe(0);
  });

  it("reserves once under concurrency and rejects forged consumption", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    await create(store);
    const [first, second] = await Promise.all([
      reserveHumanAuditEntitlement(VISITOR, {
        store,
        nowMs: START + 1,
        generateToken: () => "reservation-a",
      }),
      reserveHumanAuditEntitlement(VISITOR, {
        store,
        nowMs: START + 1,
        generateToken: () => "reservation-b",
      }),
    ]);
    const reservation = first ?? second;
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(reservation).toBeTruthy();
    if (!reservation) throw new Error("expected reservation");

    expect(
      await store.consume({
        visitorHash: OTHER_VISITOR,
        entitlementId: reservation.entitlementId,
        reservationToken: reservation.reservationToken,
        reportId: "forged-report",
        nowMs: START + 2,
      })
    ).toBe(false);
  });

  it("releases failed work and consumes exactly once on success", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    await create(store);
    const reservation = await reserveHumanAuditEntitlement(VISITOR, {
      store,
      nowMs: START + 1,
      generateToken: () => "reservation",
    });
    if (!reservation) throw new Error("expected reservation");

    await releaseHumanAuditEntitlement(VISITOR, reservation, {
      store,
      nowMs: START + 2,
    });
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, {
        store,
        nowMs: START + 2,
      })
    ).toBe(1);

    const retry = await reserveHumanAuditEntitlement(VISITOR, {
      store,
      nowMs: START + 3,
      generateToken: () => "retry",
    });
    if (!retry) throw new Error("expected retry reservation");
    await consumeHumanAuditEntitlement(VISITOR, retry, "report-1", {
      store,
      nowMs: START + 4,
    });
    await consumeHumanAuditEntitlement(VISITOR, retry, "report-1", {
      store,
      nowMs: START + 5,
    });
    expect(store.readRecord(retry.entitlementId)).toMatchObject({
      status: "consumed",
      reportId: "report-1",
    });
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, {
        store,
        nowMs: START + 5,
      })
    ).toBe(0);
  });

  it("recovers an abandoned paid reservation after its lease", async () => {
    const store = new MemoryHumanAuditEntitlementStore();
    await create(store);
    await reserveHumanAuditEntitlement(VISITOR, {
      store,
      nowMs: START,
      generateToken: () => "abandoned",
    });
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, {
        store,
        nowMs: START + HUMAN_PAID_AUDIT_RESERVATION_TTL_MS - 1,
      })
    ).toBe(0);
    expect(
      await getAvailableHumanAuditEntitlements(VISITOR, {
        store,
        nowMs: START + HUMAN_PAID_AUDIT_RESERVATION_TTL_MS,
      })
    ).toBe(1);
  });

  it("uses one Redis script for atomic settlement idempotency", async () => {
    const evalMock = vi.fn(async (..._args: unknown[]) => [1, "entitlement-1"]);
    const store = new RedisHumanAuditEntitlementStore({ eval: evalMock });
    await create(store as never);

    expect(evalMock).toHaveBeenCalledOnce();
    expect(evalMock.mock.calls[0][1]).toBe(3);
    expect(String(evalMock.mock.calls[0])).not.toContain("private-key");
  });
});
