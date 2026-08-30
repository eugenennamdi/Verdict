import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

const walletState = vi.hoisted(() => ({
  account: {
    address: undefined as `0x${string}` | undefined,
    chainId: undefined as number | undefined,
    isConnected: false,
  },
  walletClient: undefined as object | undefined,
  openAccountModal: vi.fn(),
  openConnectModal: vi.fn(),
  switchChainAsync: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => walletState.account,
  useSwitchChain: () => ({
    isPending: false,
    switchChainAsync: walletState.switchChainAsync,
  }),
  useWalletClient: () => ({ data: walletState.walletClient }),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useAccountModal: () => ({ openAccountModal: walletState.openAccountModal }),
  useConnectModal: () => ({ openConnectModal: walletState.openConnectModal }),
}));

vi.mock("@/lib/humanAuditPaymentClient", () => ({
  classifyHumanAuditPaymentError: () => "failed",
  purchaseHumanAuditEntitlement: vi.fn(),
}));

import {
  HumanAuditPaywallDialog,
  paywallAction,
} from "./HumanAuditPaywallDialog";

function usage(paidAvailable = 0): HumanAuditUsageState {
  return {
    free: {
      limit: 3,
      used: 3,
      remaining: 0,
      nextAvailableAt: "2026-08-31T10:00:00.000Z",
    },
    paid: { available: paidAvailable },
    canStartAudit: paidAvailable > 0,
  };
}

function renderDialog(state = usage()): string {
  return renderToStaticMarkup(
    createElement(HumanAuditPaywallDialog, {
      usage: state,
      auditUrl: "https://example.com/pricing",
      onUsage: () => undefined,
      onClose: () => undefined,
      onRunAudit: () => undefined,
    })
  );
}

describe("exhausted-quota payment preview", () => {
  beforeEach(() => {
    walletState.account = {
      address: undefined,
      chainId: undefined,
      isConnected: false,
    };
    walletState.walletClient = undefined;
    vi.clearAllMocks();
  });

  it("explains the audit price and asks a disconnected visitor to connect", () => {
    const html = renderDialog();
    expect(html).toContain("Your free audits are used");
    expect(html).toContain("$0.50 USDC");
    expect(html).toContain("Connect Wallet");
    expect(html).toContain("example.com");
    expect(html).not.toContain("Continue · $0.50");
  });

  it("shows a network switch before payment when needed", () => {
    walletState.account = {
      address: "0x727e00000000000000000000000000000000f3B8",
      chainId: 1,
      isConnected: true,
    };
    walletState.walletClient = {};
    expect(renderDialog()).toContain("Switch to Base Sepolia");
  });

  it("shows the explicit payment action only on the configured network", () => {
    walletState.account = {
      address: "0x727e00000000000000000000000000000000f3B8",
      chainId: 84532,
      isConnected: true,
    };
    walletState.walletClient = {};
    expect(renderDialog()).toContain("Pay $0.50 USDC");
  });

  it("runs the audit instead of offering another payment when entitlement exists", () => {
    expect(renderDialog(usage(1))).toContain("Run Audit");
    expect(paywallAction(0, false, false)).toBe("connect");
    expect(paywallAction(0, true, false)).toBe("switch");
    expect(paywallAction(0, true, true)).toBe("pay");
    expect(paywallAction(1, true, true)).toBe("run");
  });
});
