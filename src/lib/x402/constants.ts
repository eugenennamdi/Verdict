export const VERDICT_X402_NETWORKS = {
  baseMainnet: "eip155:8453",
  baseSepolia: "eip155:84532",
} as const;

export type VerdictX402Network =
  (typeof VERDICT_X402_NETWORKS)[keyof typeof VERDICT_X402_NETWORKS];

export const DEFAULT_VERDICT_AUDIT_PRICE = "$0.50";

export const VERDICT_CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";

export const VERDICT_AUDIT_DESCRIPTION =
  "Autonomous Verdict growth investigation";
