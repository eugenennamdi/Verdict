import type { Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

export type HumanWalletEnvironment = "development" | "production" | "test";

export function humanPaymentChainForEnvironment(
  environment: HumanWalletEnvironment
): Chain {
  return environment === "production" ? base : baseSepolia;
}

export function humanPaymentNetworkLabelForEnvironment(
  environment: HumanWalletEnvironment
): string {
  return environment === "production" ? "Base" : "Base Sepolia / testnet";
}

const environment = process.env.NODE_ENV as HumanWalletEnvironment;

export const humanPaymentChain = humanPaymentChainForEnvironment(environment);
export const humanPaymentNetworkLabel =
  humanPaymentNetworkLabelForEnvironment(environment);
