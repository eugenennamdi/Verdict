import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FacilitatorClient } from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  SupportedResponse,
  VerifyResponse,
} from "@x402/core/types";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createHumanAuditEntitlementHandler } from "./route";
import {
  MemoryHumanAuditEntitlementStore,
  getAvailableHumanAuditEntitlements,
  recordSettledHumanAuditEntitlement,
} from "@/lib/humanAuditEntitlement";
import type { VerdictX402Config } from "@/lib/x402/server";

const PAY_TO = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const VISITOR = "signed-cookie-visitor";
const config: VerdictX402Config = {
  network: "eip155:84532",
  price: "$0.50",
  payTo: PAY_TO,
  facilitatorUrl: "https://facilitator.invalid",
};

class MockFacilitator implements FacilitatorClient {
  verifyCalls = 0;
  settleCalls = 0;

  async getSupported(): Promise<SupportedResponse> {
    return {
      kinds: [{ x402Version: 2, scheme: "exact", network: config.network }],
      extensions: [],
      signers: {},
    };
  }

  async verify(): Promise<VerifyResponse> {
    this.verifyCalls += 1;
    return { isValid: true, payer: PAYER };
  }

  async settle(
    _paymentPayload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    this.settleCalls += 1;
    return {
      success: true,
      payer: PAYER,
      transaction: `0x${"cd".repeat(32)}`,
      network: requirements.network,
    };
  }
}

function request(paymentSignature?: string, withCookie = true): NextRequest {
  const headers = new Headers({ accept: "application/json" });
  if (withCookie) headers.set("cookie", "verdict_anonymous_visitor=signed");
  if (paymentSignature) headers.set("payment-signature", paymentSignature);
  return new NextRequest("http://localhost/api/human/audit-entitlement", {
    method: "POST",
    headers,
  });
}

function decodeHeader<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
}

function encodePayment(accepted: PaymentRequirements): string {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      accepted,
      payload: {
        signature: "0x00",
        authorization: {
          from: PAYER,
          to: accepted.payTo,
          value: accepted.amount,
          validAfter: "0",
          validBefore: "9999999999",
          nonce: "0x00",
        },
      },
    })
  ).toString("base64");
}

describe("POST /api/human/audit-entitlement", () => {
  it("returns a $0.50 Base x402 challenge without running audit work", async () => {
    const facilitator = new MockFacilitator();
    const handler = createHumanAuditEntitlementHandler(config, {
      facilitator,
      resolveVisitor: () => ({ quotaIdentity: VISITOR }),
      getUsage: async () => ({
        free: { limit: 3, used: 3, remaining: 0, nextAvailableAt: null },
        paid: { available: 0 },
        canStartAudit: false,
      }),
    });

    const response = await handler(request());
    const required = decodeHeader<{
      x402Version: number;
      resource: { description: string; mimeType: string };
      accepts: PaymentRequirements[];
    }>(response.headers.get("payment-required") as string);

    expect(response.status).toBe(402);
    expect(required.x402Version).toBe(2);
    expect(required.resource).toMatchObject({
      description: "One additional Verdict autonomous growth investigation",
      mimeType: "application/json",
    });
    expect(required.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      amount: "500000",
      payTo: PAY_TO,
      extra: { paymentFlow: "upfront" },
    });
    expect(facilitator.verifyCalls).toBe(0);
    expect(facilitator.settleCalls).toBe(0);
  });

  it("establishes the signed visitor cookie on the unsigned challenge", async () => {
    const facilitator = new MockFacilitator();
    const handler = createHumanAuditEntitlementHandler(config, {
      facilitator,
      resolveVisitor: () => ({
        quotaIdentity: "new-visitor",
        setCookieHeader:
          "verdict_anonymous_visitor=signed; Path=/; HttpOnly; SameSite=Lax",
      }),
    });

    const response = await handler(request(undefined, false));
    expect(response.status).toBe(402);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(facilitator.settleCalls).toBe(0);
  });

  it("mints cookie-bound access only after settlement and returns availability", async () => {
    const facilitator = new MockFacilitator();
    const store = new MemoryHumanAuditEntitlementStore();
    const recordSettlement = vi.fn(async (visitorHash, context) => {
      await recordSettledHumanAuditEntitlement(
        visitorHash,
        context.result,
        context.requirements,
        { store, nowMs: 1, generateId: () => "entitlement-1" }
      );
    });
    const handler = createHumanAuditEntitlementHandler(config, {
      facilitator,
      resolveVisitor: (incoming) =>
        incoming.headers.get("cookie")
          ? { quotaIdentity: VISITOR }
          : {
              quotaIdentity: "new-visitor",
              setCookieHeader: "verdict_anonymous_visitor=new; HttpOnly",
            },
      recordSettlement,
      getUsage: async (visitorHash) => {
        const available = await getAvailableHumanAuditEntitlements(visitorHash, {
          store,
          nowMs: 2,
        });
        return {
          free: { limit: 3, used: 3, remaining: 0, nextAvailableAt: null },
          paid: { available },
          canStartAudit: available > 0,
        };
      },
    });
    const challenge = await handler(request());
    const required = decodeHeader<{ accepts: PaymentRequirements[] }>(
      challenge.headers.get("payment-required") as string
    );

    const response = await handler(
      request(encodePayment(required.accepts[0]))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("payment-response")).toBeTruthy();
    expect(recordSettlement).toHaveBeenCalledOnce();
    expect(payload).toMatchObject({
      entitlement: { available: 1 },
      usage: { paid: { available: 1 }, canStartAudit: true },
    });
    expect(facilitator.settleCalls).toBe(1);
  });

  it("refuses a signed retry without an established visitor cookie", async () => {
    const facilitator = new MockFacilitator();
    const handler = createHumanAuditEntitlementHandler(config, {
      facilitator,
      resolveVisitor: () => ({
        quotaIdentity: "new-visitor",
        setCookieHeader: "verdict_anonymous_visitor=new; HttpOnly",
      }),
    });

    const response = await handler(request("signed-payment", false));
    expect(response.status).toBe(409);
    expect(facilitator.settleCalls).toBe(0);
  });

  it("does not import or execute the audit engine", () => {
    const source = readFileSync(join(__dirname, "route.ts"), "utf8");
    expect(source).not.toMatch(/runVerdictAudit|Gemini|Firecrawl|persist/);
  });
});
