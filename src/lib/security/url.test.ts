import { describe, expect, it, vi } from "vitest";
import type { LookupAddress } from "node:dns";
import {
  assertSafeAuditUrl,
  isNonPublicIp,
  parseAndAssertHttpUrl,
  safeNativeFetch,
  UnsafeUrlError,
  type LookupFn,
} from "./url";

const publicLookup: LookupFn = async () => [
  { address: "8.8.8.8", family: 4 },
];

function lookupOf(records: LookupAddress[]): LookupFn {
  return async () => records;
}

async function expectUnsafe(raw: string, lookup: LookupFn = publicLookup) {
  await expect(assertSafeAuditUrl(raw, { lookup })).rejects.toBeInstanceOf(
    UnsafeUrlError
  );
}

describe("isNonPublicIp", () => {
  it("rejects private and reserved IPv4", () => {
    expect(isNonPublicIp("127.0.0.1")).toBe(true);
    expect(isNonPublicIp("10.1.1.1")).toBe(true);
    expect(isNonPublicIp("169.254.169.254")).toBe(true);
    expect(isNonPublicIp("192.168.1.1")).toBe(true);
    expect(isNonPublicIp("172.16.0.1")).toBe(true);
    expect(isNonPublicIp("0.0.0.0")).toBe(true);
  });

  it("rejects loopback, ULA, and link-local IPv6", () => {
    expect(isNonPublicIp("::1")).toBe(true);
    expect(isNonPublicIp("fc00::1")).toBe(true);
    expect(isNonPublicIp("fd12:3456:789a::1")).toBe(true);
    expect(isNonPublicIp("fe80::1")).toBe(true);
  });

  it("rejects IPv4-mapped private addresses", () => {
    expect(isNonPublicIp("::ffff:10.1.1.1")).toBe(true);
    expect(isNonPublicIp("::ffff:127.0.0.1")).toBe(true);
    expect(isNonPublicIp("::ffff:7f00:1")).toBe(true);
    expect(isNonPublicIp("::ffff:a01:101")).toBe(true);
  });

  it("accepts IPv4-mapped public addresses in Node canonical form", () => {
    expect(isNonPublicIp("::ffff:8.8.8.8")).toBe(false);
    expect(isNonPublicIp("::ffff:808:808")).toBe(false);
  });

  it("accepts public addresses", () => {
    expect(isNonPublicIp("8.8.8.8")).toBe(false);
    expect(isNonPublicIp("1.1.1.1")).toBe(false);
    expect(isNonPublicIp("2001:4860:4860::8888")).toBe(false);
  });
});

describe("parseAndAssertHttpUrl", () => {
  it("rejects unsupported protocols", () => {
    expect(() => parseAndAssertHttpUrl("ftp://example.com")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("javascript:alert(1)")).toThrow(UnsafeUrlError);
  });

  it("rejects embedded credentials", () => {
    expect(() =>
      parseAndAssertHttpUrl("https://user:pass@example.com")
    ).toThrow(UnsafeUrlError);
  });

  it("rejects localhost and internal names", () => {
    expect(() => parseAndAssertHttpUrl("http://localhost")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://foo.local")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://foo.localhost")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://foo.internal")).toThrow(UnsafeUrlError);
  });

  it("rejects private IPv4 literals without DNS", () => {
    expect(() => parseAndAssertHttpUrl("http://127.0.0.1")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://10.1.1.1")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://169.254.169.254")).toThrow(UnsafeUrlError);
  });

  it("rejects Node-canonicalized private IPv4 representations", () => {
    expect(() => parseAndAssertHttpUrl("http://2130706433")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://0x7f000001")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://0177.0.0.1")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://127.1")).toThrow(UnsafeUrlError);
  });

  it("rejects IPv4-mapped IPv6 literals including Node canonical form", () => {
    expect(() => parseAndAssertHttpUrl("http://[::ffff:127.0.0.1]")).toThrow(UnsafeUrlError);
    expect(() => parseAndAssertHttpUrl("http://[::ffff:7f00:1]")).toThrow(UnsafeUrlError);
  });

  it("rejects loopback IPv6 literals", () => {
    expect(() => parseAndAssertHttpUrl("http://[::1]")).toThrow(UnsafeUrlError);
  });

  it("rejects link-local IPv6 literals", () => {
    expect(() => parseAndAssertHttpUrl("http://[fe80::1]")).toThrow(UnsafeUrlError);
  });
});

describe("assertSafeAuditUrl", () => {
  it("accepts representative public URLs when DNS is public", async () => {
    const linear = await assertSafeAuditUrl("https://linear.app", {
      lookup: publicLookup,
    });
    expect(linear.href).toBe("https://linear.app/");

    const example = await assertSafeAuditUrl("https://example.com/path", {
      lookup: publicLookup,
    });
    expect(example.hostname).toBe("example.com");
  });

  it("rejects a public-looking hostname that resolves privately", async () => {
    await expectUnsafe(
      "https://evil.example",
      lookupOf([{ address: "127.0.0.1", family: 4 }])
    );
    await expectUnsafe(
      "https://evil.example",
      lookupOf([{ address: "10.1.1.1", family: 4 }])
    );
    await expectUnsafe(
      "https://evil.example",
      lookupOf([
        { address: "8.8.8.8", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ])
    );
    await expectUnsafe(
      "https://evil.example",
      lookupOf([{ address: "::1", family: 6 }])
    );
    await expectUnsafe(
      "https://evil.example",
      lookupOf([{ address: "fe80::1", family: 6 }])
    );
  });

  it("fails closed when DNS lookup exceeds 5 seconds", async () => {
    vi.useFakeTimers();
    const hanging: LookupFn = () => new Promise(() => {});
    const pending = assertSafeAuditUrl("https://example.com", { lookup: hanging });
    const expectation = expect(pending).rejects.toMatchObject({
      name: "UnsafeUrlError",
      message: "DNS lookup timed out",
    });
    await vi.advanceTimersByTimeAsync(5000);
    await expectation;
    vi.useRealTimers();
  });
});

describe("safeNativeFetch redirects", () => {
  it("refuses to follow a redirect to a private address", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/secret" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      safeNativeFetch("https://example.com", { maxRedirects: 3 }, { lookup: publicLookup })
    ).rejects.toBeInstanceOf(UnsafeUrlError);

    vi.unstubAllGlobals();
  });

  it("enforces a hard redirect cap", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://example.com/next" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      safeNativeFetch("https://example.com", { maxRedirects: 2 }, { lookup: publicLookup })
    ).rejects.toMatchObject({ name: "UnsafeUrlError" });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("does not treat 304 as a redirect", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(null, {
        status: 304,
        headers: { Location: "http://127.0.0.1/secret" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await safeNativeFetch(
      "https://example.com",
      { maxRedirects: 3 },
      { lookup: publicLookup }
    );
    expect(response.status).toBe(304);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
