import { describe, expect, it, vi } from "vitest";
import {
  HUMAN_AUDIT_RESERVATION_TTL_MS,
  MemoryHumanAuditQuotaStore,
  RedisHumanAuditQuotaStore,
  canStartHumanAudit,
  getHumanAuditQuota,
  recordSuccessfulHumanAudit,
  releaseHumanAuditReservation,
} from "./humanAuditQuota";
import { HUMAN_AUDIT_QUOTA_WINDOW_MS } from "./humanAuditQuotaContract";

const VISITOR = "visitor-hash";
const START = Date.UTC(2026, 7, 3, 10, 0, 0);

async function complete(
  store: MemoryHumanAuditQuotaStore,
  nowMs: number,
  index: number
) {
  const access = await canStartHumanAudit(VISITOR, {
    store,
    nowMs,
    generateToken: () => `reservation-${index}`,
  });
  expect(access.allowed).toBe(true);
  if (!access.allowed) throw new Error("expected reservation");
  return recordSuccessfulHumanAudit(
    VISITOR,
    access.reservationToken,
    `report-${index}`,
    { store, nowMs }
  );
}

describe("human audit rolling quota", () => {
  it("moves from three remaining to zero after three successful audits", async () => {
    const store = new MemoryHumanAuditQuotaStore();
    expect(await getHumanAuditQuota(VISITOR, { store, nowMs: START })).toEqual({
      limit: 3,
      used: 0,
      remaining: 3,
      nextAvailableAt: null,
    });
    expect((await complete(store, START, 1)).remaining).toBe(2);
    expect((await complete(store, START + 1_000, 2)).remaining).toBe(1);
    const exhausted = await complete(store, START + 2_000, 3);
    expect(exhausted).toEqual({
      limit: 3,
      used: 3,
      remaining: 0,
      nextAvailableAt: new Date(START + HUMAN_AUDIT_QUOTA_WINDOW_MS).toISOString(),
    });

    const fourth = await canStartHumanAudit(VISITOR, {
      store,
      nowMs: START + 3_000,
      generateToken: () => "reservation-4",
    });
    expect(fourth.allowed).toBe(false);
  });

  it("expires successful entries independently in the rolling window", async () => {
    const store = new MemoryHumanAuditQuotaStore();
    await complete(store, START, 1);
    await complete(store, START + 4 * 60 * 60_000, 2);
    await complete(store, START + 10 * 60 * 60_000, 3);

    const before = await getHumanAuditQuota(VISITOR, {
      store,
      nowMs: START + HUMAN_AUDIT_QUOTA_WINDOW_MS - 1,
    });
    expect(before.remaining).toBe(0);
    expect(before.nextAvailableAt).toBe(
      new Date(START + HUMAN_AUDIT_QUOTA_WINDOW_MS).toISOString()
    );

    const atExpiry = await getHumanAuditQuota(VISITOR, {
      store,
      nowMs: START + HUMAN_AUDIT_QUOTA_WINDOW_MS,
    });
    expect(atExpiry).toMatchObject({ used: 2, remaining: 1, nextAvailableAt: null });
  });

  it("releases failed work without consuming quota", async () => {
    const store = new MemoryHumanAuditQuotaStore();
    const access = await canStartHumanAudit(VISITOR, {
      store,
      nowMs: START,
      generateToken: () => "failed-reservation",
    });
    expect(access.allowed).toBe(true);
    if (!access.allowed) throw new Error("expected reservation");
    expect(access.quota).toMatchObject({ used: 0, remaining: 2 });

    const released = await releaseHumanAuditReservation(
      VISITOR,
      access.reservationToken,
      { store, nowMs: START + 1_000 }
    );
    expect(released).toMatchObject({ used: 0, remaining: 3 });
  });

  it("prevents simultaneous requests from exceeding the last free slot", async () => {
    const store = new MemoryHumanAuditQuotaStore();
    await complete(store, START, 1);
    await complete(store, START + 1, 2);

    const [first, second] = await Promise.all([
      canStartHumanAudit(VISITOR, {
        store,
        nowMs: START + 2,
        generateToken: () => "tab-one",
      }),
      canStartHumanAudit(VISITOR, {
        store,
        nowMs: START + 2,
        generateToken: () => "tab-two",
      }),
    ]);
    expect([first.allowed, second.allowed].sort()).toEqual([false, true]);
  });

  it("recovers an abandoned reservation after its lease expires", async () => {
    const store = new MemoryHumanAuditQuotaStore();
    await canStartHumanAudit(VISITOR, {
      store,
      nowMs: START,
      generateToken: () => "abandoned",
    });
    expect(
      await getHumanAuditQuota(VISITOR, {
        store,
        nowMs: START + HUMAN_AUDIT_RESERVATION_TTL_MS - 1,
      })
    ).toMatchObject({ used: 0, remaining: 2 });
    expect(
      await getHumanAuditQuota(VISITOR, {
        store,
        nowMs: START + HUMAN_AUDIT_RESERVATION_TTL_MS,
      })
    ).toMatchObject({ used: 0, remaining: 3 });
  });

  it("uses one Redis eval for an atomic reservation", async () => {
    const evalMock = vi.fn(async (..._args: unknown[]) => [
      1,
      0,
      1,
      "",
      START + 60_000,
    ]);
    const store = new RedisHumanAuditQuotaStore({ eval: evalMock });
    const result = await store.reserve({
      identity: VISITOR,
      token: "atomic-token",
      nowMs: START,
      expiresAt: START + 60_000,
      limit: 3,
    });
    expect(result.accepted).toBe(true);
    expect(evalMock).toHaveBeenCalledOnce();
    expect(evalMock.mock.calls[0][1]).toBe(2);
  });
});
