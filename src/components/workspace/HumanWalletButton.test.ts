import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const walletState = vi.hoisted(() => ({
  account: {
    address: undefined as `0x${string}` | undefined,
    chain: undefined as { id: number; name: string } | undefined,
    chainId: undefined as number | undefined,
    isConnected: false,
  },
  openConnectModal: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => walletState.account,
  useDisconnect: () => ({
    disconnect: walletState.disconnect,
    isPending: false,
  }),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: walletState.openConnectModal }),
}));

import {
  ConnectedWalletMenu,
  HumanWalletButton,
  copyWalletAddress,
  openWalletModal,
  shortenWalletAddress,
} from "./HumanWalletButton";

describe("workspace wallet button", () => {
  beforeEach(() => {
    walletState.account = {
      address: undefined,
      chain: undefined,
      chainId: undefined,
      isConnected: false,
    };
    vi.clearAllMocks();
  });

  it("renders the rounded brand-color Connect Wallet action", () => {
    const html = renderToStaticMarkup(createElement(HumanWalletButton));
    expect(html).toContain("Connect Wallet");
    expect(html).toContain("rounded-full");
    expect(html).toContain("bg-orange-500");
    expect(html).not.toContain("WalletCards");

    openWalletModal(walletState.openConnectModal);
    expect(walletState.openConnectModal).toHaveBeenCalledOnce();
  });

  it("renders only the connected wallet identity in the header pill", () => {
    walletState.account = {
      address: "0x727e00000000000000000000000000000000f3B8",
      chain: { id: 84532, name: "Base Sepolia" },
      chainId: 84532,
      isConnected: true,
    };

    const html = renderToStaticMarkup(createElement(HumanWalletButton));
    expect(html).toContain("0x727e…f3B8");
    expect(html).not.toContain("Base Sepolia");
    expect(html).not.toContain("Disconnect wallet");
    expect(html).not.toContain("bg-orange-500");
    expect(
      shortenWalletAddress("0x727e00000000000000000000000000000000f3B8")
    ).toBe("0x727e…f3B8");

  });

  it("renders account, copy, network, and disconnect controls in the open menu", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectedWalletMenu, {
        address: "0x727e00000000000000000000000000000000f3B8",
        chainName: "Base Sepolia",
        correctNetwork: true,
        copied: false,
        disconnecting: false,
        onCopy: () => undefined,
        onDisconnect: () => undefined,
      })
    );
    expect(html).toContain("Connected wallet");
    expect(html).toContain("0x727e…f3B8");
    expect(html).toContain("Copy wallet address");
    expect(html).toContain("Base Sepolia");
    expect(html).toContain("Disconnect wallet");
    expect(html).toContain("Network");
    expect(html).toContain("base-square-blue.svg");
    expect(html).toContain(">Base<");
    expect(html).not.toContain("bg-emerald");
    expect(html).not.toContain("bg-orange-500");
  });

  it("copies only through an explicitly provided clipboard writer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyWalletAddress("0xabc", writeText)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("0xabc");
    await expect(copyWalletAddress("0xabc", undefined)).resolves.toBe(false);
  });
});
