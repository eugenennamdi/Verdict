import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const HUMAN_AUDIT_VISITOR_COOKIE = "verdict_anonymous_visitor";
export const HUMAN_AUDIT_VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type AnonymousAuditVisitor = {
  quotaIdentity: string;
  setCookieHeader?: string;
};

type ResolveVisitorOptions = {
  production?: boolean;
  secret?: string;
  generateId?: () => string;
};

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function signingSecret(explicit: string | undefined, production: boolean): string {
  const secret = explicit || process.env.VERDICT_VISITOR_COOKIE_SECRET;
  if (secret) return secret;
  if (production) {
    throw new Error(
      "VERDICT_VISITOR_COOKIE_SECRET is required in production"
    );
  }
  return "verdict-local-anonymous-visitor-secret";
}

function signature(id: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`verdict-human-audit-visitor:${id}`)
    .digest("base64url");
}

function validSignedId(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const supplied = value.slice(separator + 1);
  if (
    !/^[A-Za-z0-9_-]{32,}$/.test(id) ||
    !/^[A-Za-z0-9_-]{32,}$/.test(supplied)
  ) {
    return null;
  }
  const expected = signature(id, secret);
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length) return null;
  return timingSafeEqual(expectedBuffer, suppliedBuffer) ? id : null;
}

function serializeCookie(value: string, secure: boolean): string {
  return [
    `${HUMAN_AUDIT_VISITOR_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${HUMAN_AUDIT_VISITOR_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function resolveAnonymousAuditVisitor(
  request: Request,
  options: ResolveVisitorOptions = {}
): AnonymousAuditVisitor {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const secret = signingSecret(options.secret, production);
  const existing = validSignedId(
    cookieValue(request.headers.get("cookie"), HUMAN_AUDIT_VISITOR_COOKIE),
    secret
  );
  const id =
    existing ||
    (options.generateId ?? (() => randomBytes(32).toString("base64url")))();
  const quotaIdentity = createHash("sha256").update(id).digest("hex");

  if (existing) return { quotaIdentity };

  return {
    quotaIdentity,
    setCookieHeader: serializeCookie(
      `${id}.${signature(id, secret)}`,
      production
    ),
  };
}

export function attachAnonymousVisitorCookie<T extends Response>(
  response: T,
  visitor: AnonymousAuditVisitor
): T {
  if (visitor.setCookieHeader) {
    response.headers.append("Set-Cookie", visitor.setCookieHeader);
  }
  return response;
}
