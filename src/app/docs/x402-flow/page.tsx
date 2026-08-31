import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";

export const metadata: Metadata = {
  title: "x402 Payment Flow",
  description:
    "Technical mechanics of the x402 V2 protocol for machine-to-machine HTTP payments on Base.",
};

export default function X402FlowPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Agent API
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          x402 Protocol Flow
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          The x402 protocol defines a standard for HTTP-native micro-payments. It transforms the
          standard <code>402 Payment Required</code> status code into an automated challenge-and-retry flow.
        </p>
      </div>

      {/* Section: Protocol Mechanics */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Challenge-and-Retry Lifecycle
        </h2>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                1
              </span>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Initial Unpaid Request
              </h3>
            </div>
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8.5">
              The agent makes a standard <code>POST /api/v2/audit</code> request with the target JSON body.
              No pre-registered API key or subscription token is required.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                2
              </span>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                HTTP 402 Challenge with Payment Requirements
              </h3>
            </div>
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8.5">
              Verdict intercepts the unpaid request and responds with <code>402 Payment Required</code>.
              The response includes the <code>PAYMENT-REQUIRED</code> header detailing the exact price
              ($0.50 USDC), network (Base <code>eip155:8453</code>), receiver address, and facilitator parameters.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                3
              </span>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Client Authorization Signing
              </h3>
            </div>
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8.5">
              The agent&apos;s x402 client wrapper evaluates the challenge and produces an EIP-712 / EVM
              payment authorization signature from its local wallet private key.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                4
              </span>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Authorized Request & Verification
              </h3>
            </div>
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8.5">
              The request is retried with the <code>PAYMENT-SIGNATURE</code> header. Verdict verifies the
              signature and settles payment authorization on Base before commencing computational audit work.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
                5
              </span>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Fulfillment & 200 OK
              </h3>
            </div>
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 pl-8.5">
              Upon successful audit execution, the server returns <code>200 OK</code> with the structured
              JSON audit result and the <code>PAYMENT-RESPONSE</code> receipt header.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Header Specifications */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Key HTTP Header Specifications
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Header</th>
                <th className="px-5 py-3.5 font-semibold w-28">Direction</th>
                <th className="px-5 py-3.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-slate-950 dark:text-white">
                  PAYMENT-REQUIRED
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">Server → Client</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                  Base64-encoded JSON or JSON string detailing accepted payment schemes, asset address, amount, and recipient.
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-slate-950 dark:text-white">
                  PAYMENT-SIGNATURE
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">Client → Server</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                  Cryptographic signature matching the advertised EVM scheme proving authorization to transfer $0.50 USDC.
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-slate-950 dark:text-white">
                  PAYMENT-RESPONSE
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">Server → Client</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                  Settlement receipt metadata confirming transaction verification on Base.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <DocsPagination
        prev={{
          title: "Agent Quickstart",
          href: "/docs/agent-quickstart",
          description: "Integration code in cURL and TypeScript.",
        }}
        next={{
          title: "API reference",
          href: "/docs/api-reference",
          description: "Detailed endpoint parameters and return schemas.",
        }}
      />
    </div>
  );
}
