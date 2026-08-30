import { describe, expect, it, vi } from "vitest";
import { createUsageHandler } from "./route";

describe("GET /api/usage", () => {
  it("returns only safe quota state and establishes the visitor cookie", async () => {
    const getQuota = vi.fn(async () => ({
      limit: 3,
      used: 1,
      remaining: 2,
      nextAvailableAt: null,
    }));
    const handler = createUsageHandler({
      resolveVisitor: () => ({
        quotaIdentity: "private-redis-identity",
        setCookieHeader:
          "verdict_anonymous_visitor=signed; Path=/; HttpOnly; SameSite=Lax; Secure",
      }),
      getQuota,
    });

    const response = await handler(
      new Request("https://tryverdict.xyz/api/usage")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(await response.json()).toEqual({
      limit: 3,
      used: 1,
      remaining: 2,
      nextAvailableAt: null,
    });
    expect(getQuota).toHaveBeenCalledWith("private-redis-identity");
  });
});
