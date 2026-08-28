import { BlockList, isIP } from "node:net";
import { lookup as defaultLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export type LookupFn = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<LookupAddress[]>;

const MAX_REDIRECTS = 3;

const blocked = new BlockList();
// IPv4 loopback / unspecified / RFC1918 / link-local / CGNAT / multicast / reserved
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("224.0.0.0", 4, "ipv4");
blocked.addSubnet("240.0.0.0", 4, "ipv4");
// IPv6 loopback / unspecified / ULA / link-local / multicast
blocked.addAddress("::1", "ipv6");
blocked.addAddress("::", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");

const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "metadata.google.internal",
]);

function stripTrailingDots(hostname: string): string {
  return hostname.replace(/\.+$/, "").toLowerCase();
}

function normalizeHostname(hostname: string): string {
  const stripped = stripTrailingDots(hostname);
  if (stripped.startsWith("[") && stripped.endsWith("]")) {
    return stripped.slice(1, -1);
  }
  return stripped;
}

function ipv4MappedFromV6(ip: string): string | null {
  const lower = ip.toLowerCase();
  if (!lower.startsWith("::ffff:")) return null;

  const mapped = lower.slice("::ffff:".length);
  if (isIP(mapped) === 4) return mapped;

  // Node canonicalizes ::ffff:127.0.0.1 to ::ffff:7f00:1
  const parts = mapped.split(":");
  if (parts.length !== 2) return null;
  if (!/^[0-9a-f]{1,4}$/.test(parts[0]) || !/^[0-9a-f]{1,4}$/.test(parts[1])) {
    return null;
  }

  const hi = parseInt(parts[0], 16);
  const lo = parseInt(parts[1], 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;

  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

export function isNonPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    return blocked.check(ip, "ipv4");
  }
  if (kind === 6) {
    const mapped = ipv4MappedFromV6(ip);
    if (mapped) return isNonPublicIp(mapped);
    return blocked.check(ip, "ipv6");
  }
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = stripTrailingDots(hostname);
  if (!host) return true;
  if (BLOCKED_HOST_EXACT.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;
  return false;
}

export function parseAndAssertHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    throw new UnsafeUrlError("URL hostname is required");
  }

  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError("Localhost or internal hostnames are not allowed");
  }

  if (isIP(hostname) && isNonPublicIp(hostname)) {
    throw new UnsafeUrlError("Private or reserved IP addresses are not allowed");
  }

  return parsed;
}

export async function resolvePublicAddresses(
  hostname: string,
  lookup: LookupFn = defaultLookup as LookupFn
): Promise<LookupAddress[]> {
  if (isIP(hostname)) {
    if (isNonPublicIp(hostname)) {
      throw new UnsafeUrlError("Private or reserved IP addresses are not allowed");
    }
    return [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
  }

  let records: LookupAddress[];
  try {
    records = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<LookupAddress[]>((_, reject) =>
        setTimeout(() => reject(new UnsafeUrlError("DNS lookup timed out")), 5000)
      ),
    ]);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw error;
    throw new UnsafeUrlError("Could not resolve hostname");
  }

  if (!records || records.length === 0) {
    throw new UnsafeUrlError("Could not resolve hostname");
  }

  const blockedRecord = records.find((record) => isNonPublicIp(record.address));
  if (blockedRecord) {
    throw new UnsafeUrlError("Hostname resolves to a private or reserved address");
  }

  return records;
}

export async function assertSafeAuditUrl(
  raw: string,
  options?: { lookup?: LookupFn }
): Promise<URL> {
  const parsed = parseAndAssertHttpUrl(raw);
  await resolvePublicAddresses(
    normalizeHostname(parsed.hostname),
    options?.lookup ?? (defaultLookup as LookupFn)
  );
  return parsed;
}

function resolveRedirectUrl(current: URL, location: string): URL {
  let next: URL;
  try {
    next = new URL(location, current.href);
  } catch {
    throw new UnsafeUrlError("Redirect location is not a valid URL");
  }
  return next;
}

export async function safeNativeFetch(
  url: string,
  init: RequestInit & { maxRedirects?: number } = {},
  options?: { lookup?: LookupFn }
): Promise<Response> {
  const maxRedirects = init.maxRedirects ?? MAX_REDIRECTS;
  const { maxRedirects: _ignored, ...fetchInit } = init;
  void _ignored;

  let current = await assertSafeAuditUrl(url, options);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(current.href, {
      ...fetchInit,
      redirect: "manual",
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (!isRedirect) {
      return response;
    }

    if (hop === maxRedirects) {
      throw new UnsafeUrlError("Too many redirects");
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new UnsafeUrlError("Redirect response is missing a Location header");
    }

    const next = resolveRedirectUrl(current, location);
    current = await assertSafeAuditUrl(next.href, options);
  }

  throw new UnsafeUrlError("Too many redirects");
}
