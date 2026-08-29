import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AGENT_API_STATUS,
  AGENT_AUDIT_PATH,
  AGENT_AUDIT_PRICE,
  AGENT_BUYER_EXAMPLE,
  AGENT_UNPAID_CURL_EXAMPLE,
} from "./content";
import { DEFAULT_VERDICT_AUDIT_PRICE } from "@/lib/x402/constants";

describe("agent API documentation contract", () => {
  it("documents the canonical endpoint and canonical configured price", () => {
    expect(AGENT_AUDIT_PATH).toBe("/api/v2/audit");
    expect(AGENT_UNPAID_CURL_EXAMPLE).toContain(AGENT_AUDIT_PATH);
    expect(AGENT_BUYER_EXAMPLE).toContain(AGENT_AUDIT_PATH);
    expect(AGENT_AUDIT_PRICE).toBe(DEFAULT_VERDICT_AUDIT_PRICE);
    expect(AGENT_AUDIT_PRICE).toBe("$0.50");
  });

  it("uses the current official x402 V2 buyer packages without embedding secrets", () => {
    expect(AGENT_BUYER_EXAMPLE).toContain("@x402/fetch");
    expect(AGENT_BUYER_EXAMPLE).toContain("@x402/evm/exact/client");
    expect(AGENT_BUYER_EXAMPLE).toContain("x402Client");
    expect(AGENT_BUYER_EXAMPLE).toContain("ExactEvmScheme");
    expect(AGENT_BUYER_EXAMPLE).toContain("wrapFetchWithPayment");
    expect(AGENT_BUYER_EXAMPLE).toContain("process.env.EVM_PRIVATE_KEY");
    expect(AGENT_BUYER_EXAMPLE).not.toMatch(/0x[a-fA-F0-9]{64}/);
    expect(AGENT_BUYER_EXAMPLE).not.toContain("PAYMENT-SIGNATURE");
  });

  it("keeps the existing For Agents workspace navigation", () => {
    const sidebar = readFileSync(
      new URL("../../components/workspace/AppSidebar.tsx", import.meta.url),
      "utf8"
    );
    expect(sidebar).toContain('href="/agents"');
    expect(sidebar).toContain("For Agents");
  });

  it("does not present legacy MCP endpoints as the agent product", () => {
    const page = readFileSync(
      new URL("../../app/agents/page.tsx", import.meta.url),
      "utf8"
    );
    expect(page).not.toContain("/api/evaluate-mcp");
    expect(page).not.toContain("/api/bulk-evaluate-mcp");
    expect(page).not.toContain("X Layer");
    expect(page).not.toContain("USDT");
  });

  it("does not claim Base Mainnet payments are live or verified", () => {
    const status = Object.values(AGENT_API_STATUS).join(" ");
    expect(status).toContain("Base Sepolia settlement verified");
    expect(status).toContain("mainnet payment verification is pending");
    expect(status).not.toMatch(/Base Mainnet payments? (?:are )?(?:live|verified)/i);
    expect(status).not.toMatch(/Base Mainnet settlement (?:is )?verified/i);
  });
});
