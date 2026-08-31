import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import {
  INITIAL_HUMAN_AUDIT_USAGE_STATE,
  loadHumanAuditUsage,
  readyHumanAuditUsage,
} from "./humanAuditUsageState";

const REAL_USAGE: HumanAuditUsageState = {
  free: { limit: 3, used: 2, remaining: 1, nextAvailableAt: null },
  paid: { available: 0 },
  canStartAudit: true,
};

describe("workspace usage loading", () => {
  it("starts in a neutral loading state without fabricated quota", () => {
    expect(INITIAL_HUMAN_AUDIT_USAGE_STATE).toEqual({
      status: "loading",
      usage: null,
    });
  });

  it("accepts and displays the real API usage response", async () => {
    const fetchUsage = vi.fn(async () => ({
      ok: true,
      json: async () => REAL_USAGE,
    }));
    const state = await loadHumanAuditUsage(fetchUsage);
    expect(state).toEqual({ status: "ready", usage: REAL_USAGE });
    expect(fetchUsage).toHaveBeenCalledOnce();
  });

  it.each([
    ["HTTP failure", async () => ({ ok: false, json: async () => ({}) })],
    ["network failure", async () => Promise.reject(new Error("offline"))],
    ["invalid payload", async () => ({ ok: true, json: async () => ({}) })],
  ])("keeps Usage visible as unavailable after %s", async (_name, fetchUsage) => {
    expect(await loadHumanAuditUsage(fetchUsage)).toEqual({
      status: "unavailable",
      usage: null,
    });
  });

  it("replaces prior values when refreshed after an audit", () => {
    const afterAudit: HumanAuditUsageState = {
      free: { limit: 3, used: 3, remaining: 0, nextAvailableAt: "2026-09-01T00:00:00.000Z" },
      paid: { available: 0 },
      canStartAudit: false,
    };
    expect(readyHumanAuditUsage(REAL_USAGE).usage?.free.remaining).toBe(1);
    expect(readyHumanAuditUsage(afterAudit).usage?.free.remaining).toBe(0);
  });

  it("aborts a hanging fetch and reaches unavailable", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const statePromise = loadHumanAuditUsage(
      (signal) => {
        requestSignal = signal;
        return new Promise<never>(() => undefined);
      },
      50
    );

    await vi.advanceTimersByTimeAsync(50);

    await expect(statePromise).resolves.toEqual({
      status: "unavailable",
      usage: null,
    });
    expect(requestSignal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("can recover from unavailable on a later legitimate refresh", async () => {
    const fetchUsage = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => REAL_USAGE,
      });

    expect(await loadHumanAuditUsage(fetchUsage)).toEqual({
      status: "unavailable",
      usage: null,
    });
    expect(await loadHumanAuditUsage(fetchUsage)).toEqual({
      status: "ready",
      usage: REAL_USAGE,
    });
    expect(fetchUsage).toHaveBeenCalledTimes(2);
  });

  it("does not use fabricated defaults or couple Usage state to workspace busy state", () => {
    const workspaceSource = readFileSync(
      join(process.cwd(), "src/components/workspace/VerdictWorkspace.tsx"),
      "utf8"
    );
    const contractSource = readFileSync(
      join(process.cwd(), "src/lib/humanAuditUsageContract.ts"),
      "utf8"
    );

    expect(`${workspaceSource}\n${contractSource}`).not.toContain(
      "DEFAULT_HUMAN_AUDIT_USAGE"
    );
    expect(workspaceSource).toContain(
      'const busy = investigating || conversing;'
    );
    expect(workspaceSource).toContain('}, []);');
  });
});
