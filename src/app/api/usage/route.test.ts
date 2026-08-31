import { describe, expect, it, vi } from "vitest";
import { createUsageHandler } from "./route";

describe("GET /api/usage", () => {
  it("returns only safe quota state and establishes the visitor cookie", async () => {
    const getUsage = vi.fn(async () => ({
      free: { limit: 3, used: 1, remaining: 2, nextAvailableAt: null },
      paid: { available: 1 },
      canStartAudit: true,
    }));
    const handler = createUsageHandler({
      resolveVisitor: () => ({
        quotaIdentity: "private-redis-identity",
        setCookieHeader:
          "verdict_anonymous_visitor=signed; Path=/; HttpOnly; SameSite=Lax; Secure",
      }),
      getUsage,
    });

    const response = await handler(
      new Request("https://tryverdict.xyz/api/usage")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const payload = await response.json();
    expect(payload).toEqual({
      free: { limit: 3, used: 1, remaining: 2, nextAvailableAt: null },
      paid: { available: 1 },
      canStartAudit: true,
    });
    expect(JSON.stringify(payload)).not.toMatch(/entitlementId|visitor|settlement/i);
    expect(getUsage).toHaveBeenCalledWith("private-redis-identity");
  });

  it("times out a hanging usage read and returns a safe 503", async () => {
    vi.useFakeTimers();
    const getUsage = vi.fn(() => new Promise<never>(() => undefined));
    const handler = createUsageHandler({
      resolveVisitor: () => ({
        quotaIdentity: "private-redis-identity",
      }),
      getUsage,
      timeoutMs: 50,
    });

    const responsePromise = handler(
      new Request("https://tryverdict.xyz/api/usage")
    );
    await vi.advanceTimersByTimeAsync(50);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "HUMAN_AUDIT_QUOTA_UNAVAILABLE",
    });
    expect(getUsage).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
