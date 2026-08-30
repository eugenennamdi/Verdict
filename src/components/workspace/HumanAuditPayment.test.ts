import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HumanAuditPayment } from "./HumanAuditPayment";
import { classifyHumanAuditPaymentError } from "@/lib/humanAuditPaymentClient";

const EXHAUSTED = {
  free: {
    limit: 3,
    used: 3,
    remaining: 0,
    nextAvailableAt: "2026-08-31T10:00:00.000Z",
  },
  paid: { available: 0 },
  canStartAudit: false,
};

describe("human audit payment presentation", () => {
  it("shows the explicit one-audit Base payment CTA only after exhaustion", () => {
    const html = renderToStaticMarkup(
      createElement(HumanAuditPayment, {
        usage: EXHAUSTED,
        onUsage: () => undefined,
      })
    );
    expect(html).toContain("Pay $0.50 USDC");
    expect(html).toContain("Base network");
    expect(html).toContain("One audit entitlement");

    const freeHtml = renderToStaticMarkup(
      createElement(HumanAuditPayment, {
        usage: {
          ...EXHAUSTED,
          free: { ...EXHAUSTED.free, remaining: 1 },
          canStartAudit: true,
        },
        onUsage: () => undefined,
      })
    );
    expect(freeHtml).not.toContain("Pay $0.50 USDC");
  });

  it("shows paid access as ready without automatically starting an audit", () => {
    const html = renderToStaticMarkup(
      createElement(HumanAuditPayment, {
        usage: {
          ...EXHAUSTED,
          paid: { available: 1 },
          canStartAudit: true,
        },
        onUsage: () => undefined,
      })
    );
    expect(html).toContain("Submit the startup URL again");
    expect(html).not.toContain("Pay $0.50 USDC");
  });

  it("maps wallet decline, network, and balance errors to safe UI states", () => {
    expect(classifyHumanAuditPaymentError({ code: 4001 })).toBe("declined");
    expect(classifyHumanAuditPaymentError(new Error("wrong chain"))).toBe(
      "wrong_network"
    );
    expect(classifyHumanAuditPaymentError(new Error("insufficient balance"))).toBe(
      "insufficient_balance"
    );
    expect(classifyHumanAuditPaymentError(new Error("private failure"))).toBe(
      "failed"
    );
  });

  it("uses the official browser x402 flow without a server-held payer", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/humanAuditPaymentClient.ts"),
      "utf8"
    );
    expect(source).toContain("new x402Client()");
    expect(source).toContain("new ExactEvmScheme(signer)");
    expect(source).toContain("wrapFetchWithPayment");
    expect(source).not.toMatch(/EVM_PRIVATE_KEY|CDP_WALLET_SECRET/);
  });
});
