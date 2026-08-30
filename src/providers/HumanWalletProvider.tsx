"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState } from "react";
import {
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { humanPaymentChain } from "@/lib/humanWalletChain";
import { verdictWagmiConfig } from "@/lib/humanWalletConfig";

export function HumanWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={verdictWagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={humanPaymentChain}
          modalSize="compact"
          appInfo={{
            appName: "Verdict",
            learnMoreUrl: "https://tryverdict.xyz/agents",
          }}
          theme={lightTheme({
            accentColor: "#f97316",
            accentColorForeground: "#ffffff",
            borderRadius: "medium",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
