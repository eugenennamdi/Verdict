import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Limits & Usage",
  description:
    "Usage limits, rolling 24-hour free audit quotas, paid entitlement rules, and Agent API rate limits.",
};

export default function LimitsPage() {
  const limits = [
    {
      scope: "Human Free Tier",
      limit: "3 successful audits / rolling 24h",
      details: "Resets automatically on a rolling 24-hour basis. Failed or invalid audits do not count.",
    },
    {
      scope: "Human Paid Entitlement",
      limit: "$0.50 USDC on Base",
      details: "1 paid entitlement per on-chain payment. Unfulfilled audits automatically release reservations.",
    },
    {
      scope: "Conversational Follow-ups",
      limit: "Uncapped per active audit",
      details: "Asking clarifying questions on an existing audit does not consume new audit quota.",
    },
    {
      scope: "Agent API (x402)",
      limit: "Pay-as-you-go ($0.50 USDC)",
      details: "No monthly commitment. Rate limited by standard network concurrency and x402 settlement speed.",
    },
    {
      scope: "URL Evaluation Concurrency",
      limit: "1 active audit per session",
      details: "Prevents duplicate concurrent investigations on the same client session.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Reference
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Limits & Usage
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          A clear summary of Verdict&apos;s usage limits, rolling free quota calculation, and
          payment entitlement rules.
        </p>
      </div>

      {/* Limits Table */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          System Limits Table
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Scope</th>
                <th className="px-5 py-3.5 font-semibold">Limit / Pricing</th>
                <th className="px-5 py-3.5 font-semibold">Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {limits.map((item) => (
                <tr key={item.scope}>
                  <td className="px-5 py-3.5 font-bold text-slate-950 dark:text-white">
                    {item.scope}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-orange-600 dark:text-orange-400 font-semibold">
                    {item.limit}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                    {item.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section: Rolling Window Explained */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          How the Rolling 24-Hour Window Works
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The free quota does not reset at midnight UTC. Instead, each individual successful audit
          frees up exactly <strong>24 hours after it was executed</strong>. The workspace input bar
          dynamically shows how many free audits remain and when the next slot becomes available.
        </p>

        <DocsCallout type="note" title="Audit persistence">
          Past audit reports remain accessible permanently via their permanent report URLs, even
          after your daily quota is exhausted.
        </DocsCallout>
      </section>

      <DocsPagination
        prev={{
          title: "Scoring methodology",
          href: "/docs/scoring-methodology",
          description: "Mathematical weighting formula.",
        }}
        next={{
          title: "FAQ",
          href: "/docs/faq",
          description: "Frequently asked technical and product questions.",
        }}
      />
    </div>
  );
}
