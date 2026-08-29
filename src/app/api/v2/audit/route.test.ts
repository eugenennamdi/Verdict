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
import { createAuthorizedAuditHandler } from "@/app/api/v2/audit/route";
import type { RunVerdictAuditResult } from "@/lib/audit/runVerdictAudit";
import { ScrapingError } from "@/lib/engine";
import {
  protectVerdictAuditRoute,
  type VerdictX402Config,
} from "@/lib/x402/server";

const PAY_TO = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";
const SECRET_SENTINEL = "never-return-this-private-key";

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
      kinds: [
        {
          x402Version: 2,
          scheme: "exact",
          network: config.network,
        },
      ],
      extensions: [],
      signers: {},
    };
  }

  async verify(
    _paymentPayload: PaymentPayload,
    _paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    this.verifyCalls += 1;
    return { isValid: true, payer: PAYER };
  }

  async settle(
    _paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    this.settleCalls += 1;
    return {
      success: true,
      payer: PAYER,
      transaction: "0xabc123",
      network: paymentRequirements.network,
    };
  }
}

function request(
  body: unknown,
  paymentSignature?: string
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (paymentSignature) {
    headers.set("PAYMENT-SIGNATURE", paymentSignature);
  }
  return new NextRequest("http://localhost/api/v2/audit", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

type PaymentRequired = {
  x402Version: number;
  resource: { url: string; description: string; mimeType: string };
  accepts: PaymentRequirements[];
};

function mockAuditResult(): RunVerdictAuditResult {
  return {
    reportId: "report-123",
    overallScore: 74,
    identity: {
      company_name: "Acme",
      inferred_description: "Useful software",
      target_audience: "Teams",
      primary_cta: "Start",
    },
    pagesInspected: 2,
    evidence: [],
    evidenceCoverage: {
      pagesTotal: 2,
      pagesAcquired: 2,
      pagesFailed: 0,
      charsTotal: 12000,
      categories: { identity: 1, conversion: 1 },
    },
    finalCoverage: {
      identity: "high",
      positioning: "medium",
      messaging: "medium",
      conversion: "high",
      trust: "low",
      market: "low",
      growth: "low",
    },
    budgetUsage: {
      pagesInspected: 2,
      pagesAttempted: 2,
      evidenceChars: 12000,
      planningRounds: 1,
      maxPagesTotal: 5,
      maxPlanningRounds: 3,
      maxEvidenceChars: 80000,
    },
    stopReason: "planner_done",
    investigation: {
      candidatesDiscovered: 8,
      planningRounds: 1,
      pageAttempts: 1,
      stopReason: "planner_done",
    },
    audit: {
      company_name: "Acme",
      score_interpretation: "Promising",
      the_verdict: "Focus the message.",
      priority_matrix: [],
      pillars: [],
    },
    trace: [],
    evidenceTrace: {} as RunVerdictAuditResult["evidenceTrace"],
  } as unknown as RunVerdictAuditResult;
}

async function challengeFor(
  paidHandler: (request: NextRequest) => Promise<Response>,
  body: unknown = { url: "https://example.com" }
): Promise<{ response: Response; required: PaymentRequired }> {
  const response = await paidHandler(request(body));
  const header = response.headers.get("PAYMENT-REQUIRED");
  expect(header).toBeTruthy();
  return {
    response,
    required: decodeHeader<PaymentRequired>(header as string),
  };
}

describe("POST /api/v2/audit", () => {
  it("returns a standards-compliant Base 402 before executing the audit", async () => {
    const facilitator = new MockFacilitator();
    const runAudit = vi.fn();
    const paidHandler = protectVerdictAuditRoute(
      createAuthorizedAuditHandler({ runAudit }),
      config,
      { facilitator }
    );

    const { response, required } = await challengeFor(paidHandler);

    expect(response.status).toBe(402);
    expect(required.x402Version).toBe(2);
    expect(required.resource).toMatchObject({
      description: "Autonomous Verdict growth investigation",
      mimeType: "application/json",
    });
    expect(required.accepts).toHaveLength(1);
    expect(required.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      amount: "500000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: PAY_TO,
    });
    expect(runAudit).not.toHaveBeenCalled();
    expect(facilitator.verifyCalls).toBe(0);
    expect(facilitator.settleCalls).toBe(0);
    expect(JSON.stringify(required)).not.toContain(SECRET_SENTINEL);
  });

  it("lets a verified payment reach the audit and returns the public result", async () => {
    const facilitator = new MockFacilitator();
    const runAudit = vi.fn(async () => mockAuditResult());
    const paidHandler = protectVerdictAuditRoute(
      createAuthorizedAuditHandler({ runAudit }),
      config,
      { facilitator }
    );
    const { required } = await challengeFor(paidHandler);

    const response = await paidHandler(
      request(
        { url: "https://example.com" },
        encodePayment(required.accepts[0])
      )
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeTruthy();
    expect(runAudit).toHaveBeenCalledOnce();
    expect(runAudit).toHaveBeenCalledWith({
      url: "https://example.com/",
      persist: true,
    });
    expect(result).toMatchObject({
      reportId: "report-123",
      overallScore: 74,
      company_name: "Acme",
      pagesInspected: 2,
      stopReason: "planner_done",
    });
    expect(result).not.toHaveProperty("trace");
    expect(result).not.toHaveProperty("evidenceTrace");
    expect(JSON.stringify(result)).not.toContain(SECRET_SENTINEL);
    expect(facilitator.verifyCalls).toBe(1);
    expect(facilitator.settleCalls).toBe(1);
  });

  it("does not settle a payment when the audit fails", async () => {
    const facilitator = new MockFacilitator();
    const runAudit = vi.fn(async () => {
      throw new ScrapingError("raw fetch failure details");
    });
    const paidHandler = protectVerdictAuditRoute(
      createAuthorizedAuditHandler({ runAudit }),
      config,
      { facilitator }
    );
    const { required } = await challengeFor(paidHandler);

    const response = await paidHandler(
      request(
        { url: "https://example.com" },
        encodePayment(required.accepts[0])
      )
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "AUDIT_UNAVAILABLE",
        message: "The startup could not be audited",
      },
    });
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeNull();
    expect(facilitator.verifyCalls).toBe(1);
    expect(facilitator.settleCalls).toBe(0);
  });

  it("rejects an invalid URL after authorization without running or settling", async () => {
    const facilitator = new MockFacilitator();
    const runAudit = vi.fn();
    const paidHandler = protectVerdictAuditRoute(
      createAuthorizedAuditHandler({ runAudit }),
      config,
      { facilitator }
    );
    const { required } = await challengeFor(paidHandler, {
      url: "http://localhost",
    });

    const response = await paidHandler(
      request(
        { url: "http://localhost" },
        encodePayment(required.accepts[0])
      )
    );

    expect(response.status).toBe(400);
    expect(runAudit).not.toHaveBeenCalled();
    expect(facilitator.verifyCalls).toBe(1);
    expect(facilitator.settleCalls).toBe(0);
  });
});

describe("payment boundary regressions", () => {
  it("keeps the human investigation route unpaid", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/engine/investigate/route.ts"),
      "utf8"
    );

    expect(source).toContain("export async function POST");
    expect(source).not.toMatch(/@x402|withX402|PAYMENT-SIGNATURE/);
  });

  it("keeps both legacy MCP routes on their existing OKX payment adapter", () => {
    for (const route of ["evaluate-mcp", "bulk-evaluate-mcp"]) {
      const source = readFileSync(
        join(process.cwd(), `src/app/api/${route}/route.ts`),
        "utf8"
      );

      expect(source).toContain("@okxweb3/app-x402-next");
      expect(source).not.toMatch(/@x402\/(?:core|evm|next)/);
      expect(source).not.toContain("eip155:8453");
    }
  });
});
