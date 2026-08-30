import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  humanPaymentChainForEnvironment,
  humanPaymentNetworkLabelForEnvironment,
} from "./humanWalletChain";

describe("human wallet configuration", () => {
  it("uses Base in production and Base Sepolia in development and test", () => {
    expect(humanPaymentChainForEnvironment("production").id).toBe(8453);
    expect(humanPaymentChainForEnvironment("development").id).toBe(84532);
    expect(humanPaymentChainForEnvironment("test").id).toBe(84532);
    expect(humanPaymentNetworkLabelForEnvironment("production")).toBe("Base");
    expect(humanPaymentNetworkLabelForEnvironment("test")).toBe(
      "Base Sepolia / testnet"
    );
  });

  it("configures the official SSR wallet stack and multi-wallet discovery", () => {
    const configSource = readFileSync(
      join(process.cwd(), "src/lib/humanWalletConfig.ts"),
      "utf8"
    );
    const providerSource = readFileSync(
      join(process.cwd(), "src/providers/HumanWalletProvider.tsx"),
      "utf8"
    );

    expect(configSource).toContain("getDefaultConfig");
    expect(configSource).toContain("multiInjectedProviderDiscovery: true");
    expect(configSource).toContain("ssr: true");
    expect(configSource).toContain("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    expect(configSource).toContain(
      "configuredWalletConnectProjectId ? [walletConnectWallet] : []"
    );
    for (const wallet of [
      "coinbaseWallet",
      "metaMaskWallet",
      "rainbowWallet",
      "rabbyWallet",
      "injectedWallet",
      "walletConnectWallet",
    ]) {
      expect(configSource).toContain(wallet);
    }

    expect(providerSource).toContain("WagmiProvider");
    expect(providerSource).toContain("QueryClientProvider");
    expect(providerSource).toContain("RainbowKitProvider");
    expect(providerSource).toContain('accentColor: "#f97316"');
    expect(providerSource).toContain('fontStack: "system"');
  });

  it("constructs a Base Sepolia-only config under the test environment", async () => {
    const { VERDICT_WALLET_CONNECTORS, verdictWagmiConfig } = await import(
      "./humanWalletConfig"
    );
    expect(verdictWagmiConfig.chains.map((chain) => chain.id)).toEqual([84532]);
    expect(VERDICT_WALLET_CONNECTORS).toEqual([
      "coinbase",
      "metaMask",
      "rainbow",
      "rabby",
      "injected",
      "walletConnect",
    ]);
  });
});
