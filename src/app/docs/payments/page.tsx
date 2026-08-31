import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Payments & Quotas",
  description:
    "How human audit quotas, Base USDC entitlements, and agent x402 payments operate in Verdict.",
};

export default function PaymentsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Trust
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Payments & Quotas
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict operates on a transparent, pay-per-investigation model designed to avoid
          expensive monthly SaaS subscriptions and lock-in.
        </p>
      </div>

      {/* Human Payments vs Agent Payments */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Payment Surfaces
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Human Audits Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                Human Workspace
              </span>
              <span className="font-mono text-xs font-semibold text-slate-500">3 Free / 24h</span>
            </div>

            <h3 className="text-lg font-bold text-slate-950 dark:text-white">
              Human Audit Model
            </h3>

            <ul className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
              <li>
                • <strong>Free Tier:</strong> 3 successful new audits per rolling 24-hour window.
              </li>
              <li>
                • <strong>Paid Entitlement:</strong> $0.50 USDC on Base Mainnet per additional audit entitlement.
              </li>
              <li>
                • <strong>Non-Custodial:</strong> Payments are authorized directly from your connected browser wallet (Coinbase Wallet, MetaMask, Rainbow, Rabby, WalletConnect).
              </li>
              <li>
                • <strong>Follow-ups:</strong> Ongoing follow-up Q&A on existing audits is uncapped and free.
              </li>
            </ul>
          </div>

          {/* Agent Audits Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                Agent API
              </span>
              <span className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400">x402 V2 Protocol</span>
            </div>

            <h3 className="text-lg font-bold text-slate-950 dark:text-white">
              Agent Audit Model
            </h3>

            <ul className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
              <li>
                • <strong>Pay-Per-Request:</strong> $0.50 USDC per successful audit.
              </li>
              <li>
                • <strong>Network:</strong> Base Mainnet (<code>eip155:8453</code>) or Base Sepolia (<code>eip155:84532</code>).
              </li>
              <li>
                • <strong>Zero Friction:</strong> No API keys, no billing portal, and no monthly credit commitments.
              </li>
              <li>
                • <strong>Programmatic Settlement:</strong> Handled seamlessly via standard x402 challenge-and-retry client wrappers.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section: Reservation Safety */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Entitlement Reservation & Failure Safety
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          When an audit begins under a paid entitlement, Verdict reserves the entitlement temporarily
          for the duration of the investigation. If the investigation fails (e.g. because the target
          website is offline or unreachable), the reservation is <strong>automatically released</strong>,
          ensuring your paid entitlement remains available for your next audit.
        </p>

        <DocsCallout type="note" title="No stored balances or deposit accounts">
          Verdict does not maintain custodial wallets or account balances. Every payment is a direct,
          point-in-time USDC transfer on Base for immediate audit execution.
        </DocsCallout>
      </section>

      <DocsPagination
        prev={{
          title: "Security & privacy",
          href: "/docs/security",
          description: "Data protection and non-custodial boundaries.",
        }}
        next={{
          title: "Reliability",
          href: "/docs/reliability",
          description: "Execution caps, model resilience, and structured schemas.",
        }}
      />
    </div>
  );
}
