"use client";

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { type ClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  type Account,
  type Chain,
  type Transport,
  type TypedDataDomain,
  type TypedDataParameter,
  type WalletClient,
} from "viem";
import { humanPaymentChain } from "@/lib/humanWalletChain";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

export type HumanAuditPaymentStatus =
  | "idle"
  | "wrong_network"
  | "insufficient_balance"
  | "awaiting_signature"
  | "processing"
  | "confirmed"
  | "ready"
  | "declined"
  | "failed";

export type HumanAuditWalletClient = WalletClient<Transport, Chain, Account>;

type PurchaseOptions = {
  walletClient: HumanAuditWalletClient;
  fetchImpl?: typeof fetch;
  onStatus?: (status: HumanAuditPaymentStatus) => void;
};

function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

export function classifyHumanAuditPaymentError(
  error: unknown
): HumanAuditPaymentStatus {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    errorCode(error) === 4001 ||
    message.includes("rejected") ||
    message.includes("denied")
  ) {
    return "declined";
  }
  if (
    message.includes("insufficient") ||
    message.includes("balance") ||
    message.includes("funds")
  ) {
    return "insufficient_balance";
  }
  if (message.includes("chain") || message.includes("network")) {
    return "wrong_network";
  }
  return "failed";
}

export function createHumanAuditX402Signer(
  walletClient: HumanAuditWalletClient
): ClientEvmSigner {
  const account = walletClient.account;
  if (!account) {
    throw new Error("A connected wallet account is required");
  }

  return {
    address: account.address,
    signTypedData: async ({ domain, types, primaryType, message }) =>
      walletClient.signTypedData({
        account,
        domain: domain as TypedDataDomain,
        types: types as Record<string, readonly TypedDataParameter[]>,
        primaryType,
        message,
      }),
  };
}

export async function purchaseHumanAuditEntitlement(
  options: PurchaseOptions
): Promise<HumanAuditUsageState> {
  const onStatus = options.onStatus ?? (() => undefined);
  if (options.walletClient.chain?.id !== humanPaymentChain.id) {
    throw new Error("Wallet is connected to the wrong payment network");
  }
  const signer = createHumanAuditX402Signer(options.walletClient);

  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(signer));
  const paidFetch = wrapFetchWithPayment(options.fetchImpl ?? fetch, client);

  onStatus("awaiting_signature");
  const response = await paidFetch("/api/human/audit-entitlement", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  onStatus("processing");
  const payload = (await response.json().catch(() => null)) as
    | { usage?: HumanAuditUsageState; error?: string }
    | null;
  if (!response.ok || !payload?.usage) {
    throw new Error(payload?.error || `Payment failed with HTTP ${response.status}`);
  }
  onStatus("confirmed");
  onStatus("ready");
  return payload.usage;
}
