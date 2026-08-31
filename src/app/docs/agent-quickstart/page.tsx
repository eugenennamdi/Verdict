import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";
import {
  AGENT_BUYER_EXAMPLE,
  AGENT_UNPAID_CURL_EXAMPLE,
  AGENT_REQUEST_EXAMPLE,
  AGENT_RESPONSE_EXAMPLE,
} from "@/lib/agentApi/content";

export const metadata: Metadata = {
  title: "Agent Quickstart",
  description:
    "Quickstart guide and copy-pastable code examples for integrating Verdict with autonomous agents.",
};

export default function AgentQuickstartPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Agent API
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Agent Quickstart
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Integrate Verdict into your autonomous agent pipeline or backend service in under
          five minutes using standard TypeScript and x402 packages.
        </p>
      </div>

      {/* Section 1: Raw cURL */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          1. Inspect the HTTP 402 Payment Challenge
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          You can test the endpoint immediately with cURL without providing payment. This command
          will return <code>HTTP/1.1 402 Payment Required</code> along with the advertised Base payment parameters:
        </p>

        <DocsCodeBlock language="bash" filename="terminal">
          {AGENT_UNPAID_CURL_EXAMPLE}
        </DocsCodeBlock>
      </section>

      {/* Section 2: TypeScript Client */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          2. Install x402 Dependencies
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Install the official x402 client packages and viem in your Node/TypeScript project:
        </p>

        <DocsCodeBlock language="bash" filename="terminal">
          npm install @x402/core@2.24 @x402/evm@2.24 @x402/fetch@2.24 viem
        </DocsCodeBlock>
      </section>

      {/* Section 3: Integration Code */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          3. Execute the Autonomous Audit
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Use <code>wrapFetchWithPayment</code> to automatically intercept the 402 challenge, sign the
          $0.50 USDC authorization on Base, and receive the structured verdict:
        </p>

        <DocsCodeBlock language="typescript" filename="audit.ts">
          {AGENT_BUYER_EXAMPLE}
        </DocsCodeBlock>
      </section>

      {/* Section 4: Expected Response Shape */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          4. Response Excerpt
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The endpoint returns a structured JSON payload ready for direct downstream reasoning:
        </p>

        <DocsCodeBlock language="json" filename="response.json">
          {AGENT_RESPONSE_EXAMPLE}
        </DocsCodeBlock>
      </section>

      <DocsPagination
        prev={{
          title: "Agent API Overview",
          href: "/docs/agent-api",
          description: "Endpoint specifications and pricing.",
        }}
        next={{
          title: "x402 payment flow",
          href: "/docs/x402-flow",
          description: "Challenge-and-retry header mechanics.",
        }}
      />
    </div>
  );
}
