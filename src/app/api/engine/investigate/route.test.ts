import { describe, expect, it, vi } from "vitest";
import { createInvestigateHandler } from "./route";

const AVAILABLE = {
  allowed: true as const,
  accessType: "free" as const,
  reservationToken: "reservation-token",
  quota: { limit: 3, used: 0, remaining: 2, nextAvailableAt: null },
};
const AFTER_SUCCESS = {
  limit: 3,
  used: 1,
  remaining: 2,
  nextAvailableAt: null,
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/engine/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseDependencies() {
  return {
    resolveVisitor: () => ({
      quotaIdentity: "visitor-hash",
      setCookieHeader:
        "verdict_anonymous_visitor=signed; Path=/; HttpOnly; SameSite=Lax",
    }),
    checkAbuse: vi.fn(async () => ({ allowed: true })),
    reserveQuota: vi.fn(async () => AVAILABLE),
    commitQuota: vi.fn(async () => AFTER_SUCCESS),
    releaseQuota: vi.fn(async () => ({
      limit: 3,
      used: 0,
      remaining: 3,
      nextAvailableAt: null,
    })),
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
    expect(dependencies.commitQuota).toHaveBeenCalledWith(
      "visitor-hash",
      "reservation-token",
      "report-1"
    );
    expect(dependencies.releaseQuota).not.toHaveBeenCalled();
    expect(body).toContain('"humanAuditQuota":{"limit":3,"used":1,"remaining":2');
  });

  it("blocks the fourth new audit before engine execution", async () => {
    const dependencies = baseDependencies();
    const reserveQuota = vi.fn(async () => ({
      allowed: false as const,
      reason: "quota_exhausted" as const,
      quota: {
        limit: 3,
        used: 3,
        remaining: 0,
        nextAvailableAt: "2026-08-04T10:00:00.000Z",
      },
    }));
    const runAudit = vi.fn();
    const handler = createInvestigateHandler({
      ...dependencies,
      reserveQuota,
      runAudit: runAudit as never,
    });

    const response = await handler(request({ url: "https://example.com" }));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({
      error: "HUMAN_AUDIT_QUOTA_EXHAUSTED",
      quota: { used: 3, remaining: 0 },
    });
    expect(runAudit).not.toHaveBeenCalled();
    expect(dependencies.commitQuota).not.toHaveBeenCalled();
  });

  it("does not reserve quota for an invalid request body", async () => {
    const dependencies = baseDependencies();
    const handler = createInvestigateHandler(dependencies as never);
    const response = await handler(request({ visitorId: "client-forged" }));

    expect(response.status).toBe(400);
    expect(dependencies.reserveQuota).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid URL", Object.assign(new Error("Blocked URL"), { name: "UnsafeUrlError" })],
    ["scraping failure", new Error("SCRAPING_FAILED")],
    ["Gemini failure", new Error("MODEL_HIGH_DEMAND")],
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

    expect(dependencies.commitQuota).not.toHaveBeenCalled();
    expect(dependencies.releaseQuota).toHaveBeenCalledWith(
      "visitor-hash",
      "reservation-token"
    );
  });
});
