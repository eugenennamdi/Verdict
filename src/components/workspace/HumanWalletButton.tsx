"use client";

import { useEffect, useRef, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { Check, Copy, Power } from "lucide-react";
import { humanPaymentChain } from "@/lib/humanWalletChain";

export function shortenWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function openWalletModal(opener: (() => void) | undefined): void {
  opener?.();
}

export async function copyWalletAddress(
  address: string,
  writeText: ((value: string) => Promise<void>) | undefined
): Promise<boolean> {
  if (!writeText) return false;
  await writeText(address);
  return true;
}

export function ConnectedWalletMenu({
  address,
  chainName,
  correctNetwork,
  copied,
  disconnecting,
  onCopy,
  onDisconnect,
}: {
  address: string;
  chainName: string;
  correctNetwork: boolean;
  copied: boolean;
  disconnecting: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      id="verdict-wallet-menu"
      role="menu"
      aria-label="Connected wallet"
      className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_20px_55px_-24px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex items-center gap-2 py-1">
        <p className="min-w-0 flex-1 truncate font-mono text-[15px] font-bold text-slate-950 dark:text-white">
          {shortenWalletAddress(address)}
        </p>
        <button
          type="button"
          role="menuitem"
          onClick={onCopy}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 dark:text-slate-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-400"
          aria-label={copied ? "Wallet address copied" : "Copy wallet address"}
          title={copied ? "Copied" : "Copy address"}
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 disabled:cursor-wait disabled:opacity-45 dark:text-slate-400 dark:hover:bg-orange-950/30 dark:hover:text-orange-400"
          aria-label={disconnecting ? "Disconnecting wallet" : "Disconnect wallet"}
          title={disconnecting ? "Disconnecting…" : "Disconnect wallet"}
        >
          <Power className="size-[18px]" aria-hidden="true" />
        </button>
      </div>

      <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

      <div className="flex items-center justify-between gap-3 py-1">
        <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
          Network
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold ${
            correctNetwork
              ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-400"
          }`}
          title={chainName}
        >
          {correctNetwork ? (
            // Base's official Square asset from brand.base.org/base-brand.zip.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/base-square-blue.svg"
              alt=""
              className="size-4 rounded-[2px]"
              aria-hidden="true"
            />
          ) : null}
          {correctNetwork ? "Base" : chainName}
        </span>
      </div>
    </div>
  );
}

export function HumanWalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { address, chain, chainId, isConnected } = useAccount();
  const { disconnect, isPending: disconnecting } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const connected = isConnected && Boolean(address);

  useEffect(() => {
    if (!isOpen) return;

    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!connected || !address) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          openWalletModal(openConnectModal);
        }}
        className="inline-flex h-9 items-center justify-center rounded-full bg-orange-500 px-4 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-orange-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        Connect Wallet
      </button>
    );
  }

  const correctNetwork = chainId === humanPaymentChain.id;
  const chainName = correctNetwork
    ? humanPaymentChain.name
    : chain?.name ?? "Wrong network";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex h-9 items-center rounded-full border bg-white px-4 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 focus-visible:ring-offset-2 active:scale-[0.99] dark:bg-slate-950 ${
          isOpen
            ? "border-orange-300 ring-2 ring-orange-500/10 dark:border-orange-700"
            : "border-slate-200 hover:border-orange-300 dark:border-slate-800 dark:hover:border-orange-700"
        }`}
        aria-label={`Connected wallet ${shortenWalletAddress(address)}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="verdict-wallet-menu"
      >
        <span className="font-mono text-[12px] font-bold text-slate-900 dark:text-white">
          {shortenWalletAddress(address)}
        </span>
      </button>

      {isOpen ? (
        <ConnectedWalletMenu
          address={address}
          chainName={chainName}
          correctNetwork={correctNetwork}
          copied={copied}
          disconnecting={disconnecting}
          onCopy={() => {
            void copyWalletAddress(
              address,
              typeof navigator === "undefined"
                ? undefined
                : navigator.clipboard?.writeText.bind(navigator.clipboard)
            )
              .then((didCopy) => {
                if (!didCopy) return;
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1_500);
              })
              .catch(() => setCopied(false));
          }}
          onDisconnect={() => {
            disconnect();
            setIsOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
