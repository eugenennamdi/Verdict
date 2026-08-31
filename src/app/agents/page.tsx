import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { CopyCodeButton } from "@/components/agents/CopyCodeButton";
import {
  AGENT_API_STATUS,
  AGENT_AUDIT_PATH,
  AGENT_AUDIT_PRICE,
  AGENT_BUYER_EXAMPLE,
  AGENT_REQUEST_EXAMPLE,
  AGENT_RESPONSE_EXAMPLE,
  AGENT_UNPAID_CURL_EXAMPLE,
} from "@/lib/agentApi/content";

export const metadata: Metadata = {
  title: "Agent API | Verdict",
  description:
    "Programmatic access to Verdict's bounded growth investigation through x402 V2 on Base.",
};

const sections = [
  ["overview", "Overview"],
  ["protocol", "Protocol flow"],
  ["contract", "Request & response"],
  ["typescript", "TypeScript client"],
  ["http", "Raw HTTP"],
  ["lifecycle", "Payment lifecycle"],
  ["investigation", "What you receive"],
] as const;

const protocolSteps = [
  ["01", "Agent", "A buyer needs structured growth intelligence."],
  ["02", "POST", AGENT_AUDIT_PATH],
  ["03", "HTTP 402", "The server advertises payment requirements."],
  ["04", AGENT_AUDIT_PRICE, "USDC authorization on Base."],
  ["05", "Investigate", "Verdict performs bounded multi-page research."],
  ["06", "JSON", "The agent receives a persisted, structured result."],
] as const;

const lifecycle = [
  "Send the audit URL to the canonical endpoint.",
  "Receive HTTP 402 with x402 V2 payment requirements.",
  "Select the advertised Base payment option.",
  "Sign a USDC authorization in the buyer process.",
  "Retry the request with the payment signature.",
  "Verdict verifies payment before beginning the audit and settles successful fulfillment.",
  "Receive the JSON result and payment response metadata.",
] as const;

const investigation = [
  "Acquires and preserves the startup homepage as primary evidence.",
  "Discovers safe, same-site candidate pages without crawling the whole site.",
  "Assesses evidence gaps and selects useful supporting pages.",
  "Stops on sufficiency, planner completion, unavailable evidence, or a hard budget.",
  "Caps pages, evidence characters, planning rounds, and gather time.",
  "Grades the combined evidence and computes the overall Growth Readiness Score via fixed weights.",
] as const;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-950 p-5 font-mono text-[13px] leading-relaxed text-slate-200 shadow-md">
      <code>{children}</code>
    </pre>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 max-w-3xl space-y-2">
      <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-orange-500/20 selection:text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-slate-600 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-colors"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to workspace</span>
          </Link>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16 lg:py-16 flex-1 w-full">
        {/* Sticky On-Page TOC */}
        <aside className="hidden lg:block">
          <nav
            className="sticky top-24 border-l border-slate-200/80 pl-4 dark:border-slate-800/80"
            aria-label="Agent API sections"
          >
            <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              On this page
            </p>
            <ul className="space-y-2.5">
              {sections.map(([id, label]) => (
                <li key={id}>
                  <a
                    className="block text-[13.5px] text-slate-500 transition-colors hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400"
                    href={`#${id}`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Documentation Content */}
        <main className="min-w-0 space-y-16 sm:space-y-20">
          {/* Section: Overview */}
          <section id="overview" className="scroll-mt-24 border-b border-slate-200/80 pb-16 dark:border-slate-800/80 space-y-6">
            <div className="space-y-3">
              <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Verdict Agent API
              </p>
              <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl sm:leading-[1.08]">
                Autonomous growth investigation, paid programmatically.
              </h1>
              <p className="max-w-3xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-2">
                Send a startup URL. Verdict performs a bounded, multi-page evidence investigation,
                grades the combined evidence, persists the report, and returns structured JSON for
                your agent to use.
              </p>
            </div>

            {/* Spec Table */}
            <dl className="mt-8 grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Endpoint", `POST ${AGENT_AUDIT_PATH}`],
                ["Price", `${AGENT_AUDIT_PRICE} USDC`],
                ["Network", AGENT_API_STATUS.productionNetwork],
                ["Protocol", "x402 V2"],
                ["Response", "JSON"],
              ].map(([term, detail]) => (
                <div
                  key={term}
                  className="border-b border-slate-200/80 p-5 last:border-b-0 sm:border-r sm:[&:nth-child(even)]:border-r-0 xl:border-b-0 xl:[&:nth-child(even)]:border-r xl:last:border-r-0 dark:border-slate-800/80"
                >
                  <dt className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {term}
                  </dt>
                  <dd className="mt-2 break-words font-mono text-sm font-bold text-slate-950 dark:text-white">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Section: Protocol Flow */}
          <section id="protocol" className="scroll-mt-24 border-b border-slate-200/80 pb-16 dark:border-slate-800/80 space-y-8">
            <SectionHeading
              eyebrow="Protocol"
              title="One paid request, one investigation"
              description="The payment challenge is part of normal HTTP request handling. Audit work begins only after authorization succeeds."
            />
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-6">
              {protocolSteps.map(([number, title, detail], index) => (
                <div key={number} className="contents">
                  <article className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                        {number}
                      </span>
                      <h3 className="mt-3 text-[15px] font-bold text-slate-950 dark:text-white">
                        {title}
                      </h3>
                      <p className="mt-1.5 break-words text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                        {detail}
                      </p>
                    </div>
                  </article>
                  {index < protocolSteps.length - 1 ? (
                    <ArrowDown className="mx-auto size-4 text-slate-300 dark:text-slate-600 sm:hidden" aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Section: Request & Response Contract */}
          <section id="contract" className="scroll-mt-24 border-b border-slate-200/80 pb-16 dark:border-slate-800/80 space-y-8">
            <SectionHeading
              eyebrow="Contract"
              title="A deliberately small request surface"
              description="The request accepts one field: the public startup URL to investigate."
            />
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Request body</h3>
                <CodeBlock>{AGENT_REQUEST_EXAMPLE}</CodeBlock>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Response excerpt</h3>
                <CodeBlock>{AGENT_RESPONSE_EXAMPLE}</CodeBlock>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The full public result includes the overall Growth Readiness Score, qualitative pillar
              evaluations, source grounding, executive verdict, priority matrix, and evidence coverage
              metrics. It excludes scraped markdown, prompts, payment signatures, and private model reasoning.
            </p>
          </section>

          {/* Section: TypeScript Client */}
          <section id="typescript" className="scroll-mt-24 border-b border-slate-200/80 pb-16 dark:border-slate-800/80 space-y-6">
            <SectionHeading
              eyebrow="Buyer"
              title="Call Verdict with the official x402 V2 client"
              description="The wrapper handles the initial 402 challenge, signs the advertised EVM payment, and retries the request."
            />
            <CodeBlock>npm install @x402/core@2.24 @x402/evm@2.24 @x402/fetch@2.24 viem</CodeBlock>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 bg-slate-900/60">
                <span className="font-mono text-xs font-semibold text-slate-400">audit.ts</span>
                <CopyCodeButton value={AGENT_BUYER_EXAMPLE} />
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-slate-200">
                <code>{AGENT_BUYER_EXAMPLE}</code>
              </pre>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 text-[13.5px] leading-relaxed text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-300 shadow-sm">
              Keep <code className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">EVM_PRIVATE_KEY</code> in a server-side secret
              manager. Never ship a payer key to browser code, logs, or source control.
            </div>
          </section>

          {/* Section: Raw HTTP */}
          <section id="http" className="scroll-mt-24 border-b border-slate-200/80 pb-16 dark:border-slate-800/80 space-y-6">
            <SectionHeading
              eyebrow="Raw HTTP"
              title="Inspect the payment challenge"
              description="This curl command is intentionally unpaid. It demonstrates the initial request and should return HTTP 402 with payment requirements; it does not complete an audit."
            />
            <CodeBlock>{AGENT_UNPAID_CURL_EXAMPLE}</CodeBlock>
          </section>

          {/* Section: Payment Lifecycle */}
          <section id="lifecycle" className="scroll-mt-24 border-b border-slate-200/80 pb-16 dark:border-slate-800/80 space-y-8">
            <SectionHeading
              eyebrow="Lifecycle"
              title="Payment and fulfillment"
              description="Verdict uses x402 V2's challenge-and-retry flow while keeping payment verification ahead of costly audit execution."
            />
            <ol className="grid gap-3.5 md:grid-cols-2">
              {lifecycle.map((item, index) => (
                <li
                  key={item}
                  className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Section: What the Agent Buys */}
          <section id="investigation" className="scroll-mt-24 pt-4 space-y-8">
            <SectionHeading
              eyebrow="Product"
              title="What the agent buys"
              description="This is bounded investigation, not an exhaustive crawl. Verdict seeks enough useful evidence to produce a defensible growth-readiness assessment within fixed limits."
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              {investigation.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-sm"
                >
                  <span className="mt-2 size-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-sm">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                The public response reports pages inspected, pages accepted, evidence coverage, sources,
                and the stop reason so downstream agents can judge the investigation scope.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
