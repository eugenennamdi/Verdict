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
});
