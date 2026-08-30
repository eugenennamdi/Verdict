"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { humanPaymentChain } from "@/lib/humanWalletChain";

export const VERDICT_WALLET_CONNECTORS = [
  "coinbase",
  "metaMask",
  "rainbow",
  "rabby",
  "injected",
  "walletConnect",
] as const;

const configuredWalletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

// RainbowKit requires a non-empty value while constructing its connectors,
// including during Next.js prerendering. The inert local fallback keeps the
// free workspace available; the standalone WalletConnect option is omitted
// until a real public project ID is configured.
const walletConnectProjectId =
  configuredWalletConnectProjectId ?? "00000000000000000000000000000000";

export const verdictWagmiConfig = getDefaultConfig({
  appName: "Verdict",
  appDescription: "Autonomous growth investigation for startups",
  appUrl: "https://tryverdict.xyz",
  projectId: walletConnectProjectId,
  chains: [humanPaymentChain],
  wallets: [
    {
      groupName: "Choose a wallet",
      wallets: [
        coinbaseWallet,
        metaMaskWallet,
        rainbowWallet,
        rabbyWallet,
        injectedWallet,
        ...(configuredWalletConnectProjectId ? [walletConnectWallet] : []),
      ],
    },
  ],
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
