"use client";

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { type ClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  createWalletClient,
  custom,
  type TypedDataDomain,
  type TypedDataParameter,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

export type HumanAuditPaymentStatus =
  | "idle"
  | "connecting"
  | "wrong_network"
  | "insufficient_balance"
  | "awaiting_signature"
  | "processing"
  | "confirmed"
  | "ready"
  | "declined"
  | "failed";

export type Eip1193Provider = {
  request(input: {
    method: string;
    params?: readonly unknown[] | object;
  }): Promise<unknown>;
};

type PurchaseOptions = {
  provider: Eip1193Provider;
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

export async function purchaseHumanAuditEntitlement(
  options: PurchaseOptions
): Promise<HumanAuditUsageState> {
  const onStatus = options.onStatus ?? (() => undefined);
  const chain = process.env.NODE_ENV === "production" ? base : baseSepolia;
  const chainId = `0x${chain.id.toString(16)}`;

  onStatus("connecting");
  const accounts = (await options.provider.request({
    method: "eth_requestAccounts",
  })) as unknown;
  const address = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof address !== "string" || !/^0x[0-9a-f]{40}$/i.test(address)) {
    throw new Error("Wallet did not provide an EVM account");
  }

  try {
    await options.provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error: unknown) {
    if (errorCode(error) !== 4902) throw error;
    await options.provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: [chain.blockExplorers.default.url],
        },
      ],
    });
  }

  const account = address as `0x${string}`;
  const walletClient = createWalletClient({
    account,
    chain,
    transport: custom(options.provider),
  });
  const signer: ClientEvmSigner = {
    address: account,
    signTypedData: async ({ domain, types, primaryType, message }) =>
      walletClient.signTypedData({
        account,
        domain: domain as TypedDataDomain,
        types: types as Record<string, readonly TypedDataParameter[]>,
        primaryType,
        message,
      }),
  };

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
