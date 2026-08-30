"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import {
  classifyHumanAuditPaymentError,
  purchaseHumanAuditEntitlement,
  type Eip1193Provider,
  type HumanAuditPaymentStatus,
} from "@/lib/humanAuditPaymentClient";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

type HumanAuditPaymentProps = {
  usage: HumanAuditUsageState;
  onUsage: (usage: HumanAuditUsageState) => void;
};

const STATUS_COPY: Record<HumanAuditPaymentStatus, string> = {
  idle: "Pay once for one additional audit. No deposit or subscription.",
  connecting: "Connecting your wallet…",
  wrong_network: "Switch your wallet to Base and try again.",
  insufficient_balance: "This wallet does not have enough USDC for the payment.",
  awaiting_signature: "Review the $0.50 USDC authorization in your wallet.",
  processing: "Confirming the payment…",
  confirmed: "Payment confirmed.",
  ready: "One paid audit is ready. Submit the startup URL again to run it.",
  declined: "Payment was declined. Nothing was charged.",
  failed: "Payment could not be completed. Please try again.",
};

function injectedProvider(): Eip1193Provider | undefined {
  return (window as typeof window & { ethereum?: Eip1193Provider }).ethereum;
}

export function HumanAuditPayment({
  usage,
  onUsage,
}: HumanAuditPaymentProps) {
  const [status, setStatus] = useState<HumanAuditPaymentStatus>("idle");
  const busy = [
    "connecting",
    "awaiting_signature",
    "processing",
    "confirmed",
  ].includes(status);

  if (usage.free.remaining > 0) return null;
  const ready = usage.paid.available > 0 || status === "ready";

  const purchase = async () => {
    const confirmed = window.confirm(
      "Authorize a $0.50 USDC payment on Base for one additional Verdict audit?"
    );
    if (!confirmed) {
      setStatus("declined");
      return;
    }
    const provider = injectedProvider();
    if (!provider) {
      setStatus("failed");
      return;
    }
    try {
      const nextUsage = await purchaseHumanAuditEntitlement({
        provider,
        onStatus: setStatus,
      });
      onUsage(nextUsage);
    } catch (error: unknown) {
      setStatus(classifyHumanAuditPaymentError(error));
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-orange-200/80 bg-orange-50/60 px-3 py-2.5 dark:border-orange-900/60 dark:bg-orange-950/20">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
          {ready ? STATUS_COPY.ready : STATUS_COPY[status]}
        </p>
        {!ready ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void purchase()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            ) : (
              <CreditCard className="size-3" />
            )}
            Pay $0.50 USDC
          </button>
        ) : null}
      </div>
      {!ready ? (
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          Base network · User-controlled wallet · One audit entitlement
        </p>
      ) : null}
    </div>
  );
}
