import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";
import {
  AGENT_AUDIT_PATH,
  AGENT_AUDIT_PRICE,
  AGENT_AUDIT_URL,
  AGENT_API_STATUS,
} from "@/lib/agentApi/content";

export const metadata: Metadata = {
  title: "Agent API Overview",
  description:
    "Programmatic growth intelligence endpoint for autonomous agents using x402 on Base.",
};

export default function AgentApiOverviewPage() {
  const specs = [
    { label: "Endpoint", value: `POST ${AGENT_AUDIT_PATH}` },
    { label: "Canonical URL", value: AGENT_AUDIT_URL },
    { label: "Price", value: `${AGENT_AUDIT_PRICE} USDC` },
    { label: "Production Network", value: `${AGENT_API_STATUS.productionNetwork} (eip155:8453)` },
    { label: "Protocol", value: "x402 V2 Exact EVM Scheme" },
    { label: "Response Format", value: "JSON" },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Agent API
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Agent API Overview
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict exposes a programmatic, machine-to-machine growth audit endpoint designed for
          autonomous AI agents, screening bots, venture due-diligence pipelines, and developer tooling.
        </p>
      </div>

      {/* Spec Table */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Endpoint Specifications
        </h2>
        <dl className="grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs sm:grid-cols-2 lg:grid-cols-3">
          {specs.map((spec) => (
            <div
              key={spec.label}
              className="border-b border-slate-100 p-4.5 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 dark:border-slate-800/80"
            >
              <dt className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {spec.label}
              </dt>
              <dd className="mt-1.5 font-mono text-xs sm:text-sm font-bold text-slate-950 dark:text-white break-words">
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Section: How Agents Interact */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Programmatic Request Lifecycle
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The Agent API eliminates SaaS credit cards and subscription API keys in favor of
          the open <strong>x402 V2 payment protocol</strong>:
        </p>

        <ol className="mt-4 space-y-3 pl-0">
          {[
            {
              step: "1",
              title: "Agent sends initial HTTP POST",
              detail:
                "The agent sends a request with the target URL in the JSON body. No API key is required.",
            },
            {
              step: "2",
              title: "Verdict returns HTTP 402 challenge",
              detail:
                "The server responds with HTTP 402 and the PAYMENT-REQUIRED header specifying $0.50 USDC on Base.",
            },
            {
              step: "3",
              title: "Agent signs payment authorization",
              detail:
                "The agent's standard x402 client automatically signs the EVM authorization using its secure wallet key.",
            },
            {
              step: "4",
              title: "Agent retries request with payment proof",
              detail:
                "The request is retried with the signed PAYMENT-SIGNATURE header attached.",
            },
            {
              step: "5",
              title: "Verdict verifies payment and executes audit",
              detail:
                "Payment is verified on-chain ahead of execution. Verdict runs the investigation and settles fulfillment.",
            },
            {
              step: "6",
              title: "Structured JSON return",
              detail:
                "The agent receives structured JSON containing the overall score, bottleneck, evidence metrics, and priority matrix.",
            },
          ].map((item) => (
            <li
              key={item.step}
              className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {item.step}
              </span>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <DocsCallout type="security" title="Autonomous wallet key safety">
        Always store your agent&apos;s <code>EVM_PRIVATE_KEY</code> in a server-side secret
        manager or environment variable. Never expose private keys to client-side code, git
        repositories, or build logs.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Recommendations",
          href: "/docs/recommendations",
          description: "Action roadmap and prioritization.",
        }}
        next={{
          title: "Agent Quickstart",
          href: "/docs/agent-quickstart",
          description: "Copy-pastable integration code in cURL and TypeScript.",
        }}
      />
    </div>
  );
}
