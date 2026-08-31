"use client";

import { useEffect, useState } from "react";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { Check, CreditCard, Loader2, Play, WalletCards, X } from "lucide-react";
import {
  classifyHumanAuditPaymentError,
  purchaseHumanAuditEntitlement,
  type HumanAuditPaymentStatus,
} from "@/lib/humanAuditPaymentClient";
import {
  humanPaymentChain,
  humanPaymentNetworkLabel,
} from "@/lib/humanWalletChain";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import {
  openWalletModal,
  shortenWalletAddress,
} from "./HumanWalletButton";

type HumanAuditPaywallDialogProps = {
  usage: HumanAuditUsageState;
  auditUrl: string;
  onUsage: (usage: HumanAuditUsageState) => void;
  onClose: () => void;
  onRunAudit: () => void;
};

export type PaywallAction = "connect" | "switch" | "pay" | "run";

const STATUS_COPY: Record<HumanAuditPaymentStatus, string> = {
  idle: "",
  wrong_network: `Switch to ${humanPaymentChain.name} to continue.`,
  insufficient_balance: "This wallet does not have enough USDC.",
  awaiting_signature: "Check your wallet to approve the payment.",
  processing: "Confirming payment…",
  confirmed: "Payment confirmed.",
  ready: "Payment confirmed · your audit is ready.",
  declined: "Payment cancelled. Nothing was charged.",
  failed: "Payment couldn't be completed. Please try again.",
};

export function paywallAction(
  paidAvailable: number,
  connected: boolean,
  correctNetwork: boolean
): PaywallAction {
  if (paidAvailable > 0) return "run";
  if (!connected) return "connect";
  return correctNetwork ? "pay" : "switch";
}

function auditDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function HumanAuditPaywallDialog({
  usage,
  auditUrl,
  onUsage,
  onClose,
  onRunAudit,
}: HumanAuditPaywallDialogProps) {
  const [status, setStatus] = useState<HumanAuditPaymentStatus>("idle");
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { isPending: switchingNetwork, switchChainAsync } = useSwitchChain();

  const connected = isConnected && Boolean(address);
  const correctNetwork = chainId === humanPaymentChain.id;
  const ready = usage.paid.available > 0 || status === "ready";
  const action = paywallAction(
    ready ? Math.max(1, usage.paid.available) : 0,
    connected,
    correctNetwork
  );
  const busy = ["awaiting_signature", "processing", "confirmed"].includes(
    status
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  const purchase = async () => {
    if (!connected || !walletClient) {
      openWalletModal(openConnectModal);
      return;
    }
    if (!correctNetwork) {
      setStatus("wrong_network");
      return;
    }

    try {
      const nextUsage = await purchaseHumanAuditEntitlement({
        walletClient,
        onStatus: setStatus,
      });
      onUsage(nextUsage);
    } catch (error: unknown) {
      setStatus(classifyHumanAuditPaymentError(error));
    }
  };

  const act = () => {
    if (action === "connect") {
      openWalletModal(openConnectModal);
      return;
    }
    if (action === "switch") {
      setStatus("wrong_network");
      void switchChainAsync({ chainId: humanPaymentChain.id })
        .then(() => setStatus("idle"))
        .catch(() => setStatus("wrong_network"));
      return;
    }
    if (action === "pay") {
      void purchase();
      return;
    }
    onRunAudit();
  };

  const actionLabel =
    action === "connect"
      ? "Connect Wallet"
      : action === "switch"
        ? `Switch to ${humanPaymentChain.name}`
        : action === "run"
          ? "Run Audit"
          : status === "awaiting_signature"
            ? "Check Your Wallet"
            : status === "processing" || status === "confirmed"
              ? "Confirming Payment"
              : "Pay 0.5 USDC";

  const title =
    ready
      ? "Payment Confirmed"
      : busy
        ? "Confirming payment"
        : "You've used your free audits";

  const description =
    ready
      ? ""
      : busy
        ? `Authorizing 0.5 USDC payment on ${humanPaymentChain.name}. Check your wallet to approve the transaction.`
        : !connected
          ? "Run another audit for 0.5 USDC. Connect your wallet to continue."
          : !correctNetwork
            ? `Switch your wallet to ${humanPaymentChain.name} to complete the 0.5 USDC payment.`
            : `Run another audit for 0.5 USDC on ${humanPaymentChain.name}.`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close payment preview"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs"
        onClick={busy ? undefined : onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-payment-title"
        aria-describedby={description ? "audit-payment-description" : undefined}
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-900 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2.5">
          {ready && (
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 animate-in zoom-in-75 duration-200"
              aria-hidden="true"
            >
              <Check className="size-3.5 stroke-[3]" />
            </span>
          )}
          <h2
            id="audit-payment-title"
            className="text-lg font-bold tracking-tight text-slate-950 dark:text-white"
          >
            {title}
          </h2>
        </div>
        {description ? (
          <p
            id="audit-payment-description"
            className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400"
          >
            {description}
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
              Target URL
            </span>
            <span className="truncate font-mono text-[12.5px] font-semibold text-slate-900 dark:text-white">
              {auditUrl}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200/70 pt-2 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <span>{humanPaymentChain.name}</span>
            {connected && address ? (
              <button
                type="button"
                onClick={() => openWalletModal(openAccountModal)}
                className="font-mono font-medium text-slate-600 hover:text-orange-600 dark:text-slate-300 dark:hover:text-orange-400"
              >
                {shortenWalletAddress(address)} · Change
              </button>
            ) : (
              <span>User-controlled wallet</span>
            )}
          </div>
        </div>

        <button
          type="button"
          autoFocus
          disabled={busy || switchingNetwork || (action === "pay" && !walletClient)}
          onClick={act}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-[13px] font-bold text-white shadow-xs transition-colors duration-150 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-55"
        >
          {busy || switchingNetwork ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : action === "connect" ? (
            <WalletCards className="size-4" />
          ) : action === "run" ? (
            <Play className="size-3.5 fill-current" />
          ) : (
            <CreditCard className="size-4" />
          )}
          {actionLabel}
        </button>

        {status !== "idle" && !ready ? (
          <p
            role="status"
            className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400"
          >
            {STATUS_COPY[status]}
          </p>
        ) : null}
      </section>
    </div>
  );
}
