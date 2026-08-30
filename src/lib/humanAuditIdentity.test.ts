import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HUMAN_AUDIT_VISITOR_COOKIE,
  resolveAnonymousAuditVisitor,
} from "./humanAuditIdentity";

const SECRET = "test-only-cookie-signing-secret";
const FIRST_ID = "a".repeat(43);
const SECOND_ID = "b".repeat(43);

function cookiePair(setCookie: string): string {
  return setCookie.split(";", 1)[0];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("anonymous human audit visitor identity", () => {
  it("issues an opaque HttpOnly same-site cookie for a new visitor", () => {
    const visitor = resolveAnonymousAuditVisitor(
      new Request("https://tryverdict.xyz/api/usage"),
      { secret: SECRET, production: false, generateId: () => FIRST_ID }
    );

    expect(visitor.setCookieHeader).toContain(`${HUMAN_AUDIT_VISITOR_COOKIE}=`);
    expect(visitor.setCookieHeader).toContain("HttpOnly");
    expect(visitor.setCookieHeader).toContain("SameSite=Lax");
    expect(visitor.setCookieHeader).toContain("Path=/");
    expect(visitor.setCookieHeader).toContain("Max-Age=31536000");
    expect(visitor.setCookieHeader).not.toContain("Secure");
    expect(visitor.quotaIdentity).toBe(
      createHash("sha256").update(FIRST_ID).digest("hex")
    );
  });

  it("marks the cookie Secure in production and reuses a valid signed ID", () => {
    const first = resolveAnonymousAuditVisitor(
      new Request("https://tryverdict.xyz/api/usage"),
      { secret: SECRET, production: true, generateId: () => FIRST_ID }
    );
    expect(first.setCookieHeader).toContain("Secure");

    const returning = resolveAnonymousAuditVisitor(
      new Request("https://tryverdict.xyz/api/usage", {
        headers: { cookie: cookiePair(first.setCookieHeader!) },
      }),
      { secret: SECRET, production: true, generateId: () => SECOND_ID }
    );
    expect(returning.quotaIdentity).toBe(first.quotaIdentity);
    expect(returning.setCookieHeader).toBeUndefined();
  });

  it("fails safely when the dedicated production secret is missing", () => {
    vi.stubEnv("VERDICT_VISITOR_COOKIE_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "supabase-must-not-be-used");

    expect(() =>
      resolveAnonymousAuditVisitor(
        new Request("https://tryverdict.xyz/api/usage"),
        { production: true, generateId: () => FIRST_ID }
      )
    ).toThrow("VERDICT_VISITOR_COOKIE_SECRET is required in production");
  });

  it("uses the dedicated production secret rather than the Supabase service key", () => {
    const dedicatedSecret = "dedicated-production-cookie-secret";
    vi.stubEnv("VERDICT_VISITOR_COOKIE_SECRET", dedicatedSecret);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unrelated-supabase-service-key");

    const visitor = resolveAnonymousAuditVisitor(
      new Request("https://tryverdict.xyz/api/usage"),
      { production: true, generateId: () => FIRST_ID }
    );
    const cookie = decodeURIComponent(cookiePair(visitor.setCookieHeader!));
    const expectedSignature = createHmac("sha256", dedicatedSecret)
      .update(`verdict-human-audit-visitor:${FIRST_ID}`)
      .digest("base64url");
    expect(cookie).toBe(
      `${HUMAN_AUDIT_VISITOR_COOKIE}=${FIRST_ID}.${expectedSignature}`
    );
  });

  it("keeps a deterministic fallback for development and tests", () => {
    vi.stubEnv("VERDICT_VISITOR_COOKIE_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-remain-unused");

    const first = resolveAnonymousAuditVisitor(
      new Request("http://localhost/api/usage"),
      { production: false, generateId: () => FIRST_ID }
    );
    const returning = resolveAnonymousAuditVisitor(
      new Request("http://localhost/api/usage", {
        headers: { cookie: cookiePair(first.setCookieHeader!) },
      }),
      { production: false, generateId: () => SECOND_ID }
    );

    expect(returning.quotaIdentity).toBe(first.quotaIdentity);
    expect(returning.setCookieHeader).toBeUndefined();
  });

  it("rejects a client-forged visitor cookie instead of accepting its quota identity", () => {
    const forgedId = "z".repeat(43);
    const visitor = resolveAnonymousAuditVisitor(
      new Request("https://tryverdict.xyz/api/usage", {
        headers: {
          cookie: `${HUMAN_AUDIT_VISITOR_COOKIE}=${forgedId}.${"x".repeat(43)}`,
        },
      }),
      { secret: SECRET, production: true, generateId: () => SECOND_ID }
    );

    expect(visitor.quotaIdentity).toBe(
      createHash("sha256").update(SECOND_ID).digest("hex")
    );
    expect(visitor.quotaIdentity).not.toBe(
      createHash("sha256").update(forgedId).digest("hex")
    );
    expect(visitor.setCookieHeader).toBeDefined();
  });
});
