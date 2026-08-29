import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowLeft, CheckCircle2, CircleDot } from "lucide-react";
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
  "Grades the combined evidence and produces the deterministic seven-pillar score.",
] as const;

function VerdictMark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-sm font-semibold text-white">
      V
    </span>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-[13px] leading-6 text-zinc-200 shadow-sm">
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
    <div className="mb-7 max-w-3xl">
      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-7 text-zinc-600">{description}</p>
      ) : null}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <VerdictMark />
            Verdict
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950"
          >
            <ArrowLeft className="size-4" />
            Workspace
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <aside className="hidden lg:block">
          <nav className="sticky top-8 border-l border-zinc-200 pl-5" aria-label="Agent API sections">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              On this page
            </p>
            <ul className="space-y-3">
              {sections.map(([id, label]) => (
                <li key={id}>
                  <a className="text-sm text-zinc-600 transition hover:text-zinc-950" href={`#${id}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0">
          <section id="overview" className="scroll-mt-8 border-b border-zinc-200 pb-16">
            <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Verdict Agent API
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-6xl sm:leading-[1.06]">
              Autonomous growth investigation, paid programmatically.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600">
              Send a startup URL. Verdict performs a bounded, multi-page evidence investigation,
              grades the combined evidence, persists the report, and returns structured JSON for
              your agent to use.
            </p>

            <dl className="mt-10 grid overflow-hidden rounded-xl border border-zinc-200 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Endpoint", `POST ${AGENT_AUDIT_PATH}`],
                ["Price", `${AGENT_AUDIT_PRICE} USDC`],
                ["Network", AGENT_API_STATUS.productionNetwork],
                ["Protocol", "x402 V2"],
                ["Response", "JSON"],
              ].map(([term, detail]) => (
                <div key={term} className="border-b border-zinc-200 p-5 last:border-b-0 sm:border-r sm:[&:nth-child(even)]:border-r-0 xl:border-b-0 xl:[&:nth-child(even)]:border-r xl:last:border-r-0">
                  <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">{term}</dt>
                  <dd className="mt-2 break-words font-mono text-sm font-semibold text-zinc-900">{detail}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-7 border-l-2 border-indigo-500 bg-indigo-50 px-5 py-4 text-sm leading-6 text-indigo-950">
              <strong>{AGENT_API_STATUS.testStatus}</strong>{" "}
              {AGENT_API_STATUS.productionStatus}
            </div>
          </section>

          <section id="protocol" className="scroll-mt-8 border-b border-zinc-200 py-16">
            <SectionHeading
              eyebrow="Protocol"
              title="One paid request, one investigation"
              description="The payment challenge is part of normal HTTP request handling. Audit work begins only after authorization succeeds."
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {protocolSteps.map(([number, title, detail], index) => (
                <div key={number} className="contents">
                  <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <span className="font-mono text-[11px] font-semibold text-indigo-600">{number}</span>
                    <h3 className="mt-5 text-sm font-semibold text-zinc-950">{title}</h3>
                    <p className="mt-2 break-words text-xs leading-5 text-zinc-600">{detail}</p>
                  </article>
                  {index < protocolSteps.length - 1 ? (
                    <ArrowDown className="mx-auto size-4 text-zinc-300 sm:hidden" aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section id="contract" className="scroll-mt-8 border-b border-zinc-200 py-16">
            <SectionHeading
              eyebrow="Contract"
              title="A deliberately small request surface"
              description="The request accepts one field: the public startup URL to investigate."
            />
            <div className="grid gap-7 xl:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">Request body</h3>
                <CodeBlock>{AGENT_REQUEST_EXAMPLE}</CodeBlock>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">Response excerpt</h3>
                <CodeBlock>{AGENT_RESPONSE_EXAMPLE}</CodeBlock>
              </div>
            </div>
            <p className="mt-6 max-w-3xl text-sm leading-6 text-zinc-600">
              The full public result includes the verdict, seven scoring pillars, priority matrix,
              evidence coverage, and investigation budget summary. It excludes scraped markdown,
              prompts, payment signatures, and private model reasoning.
            </p>
          </section>

          <section id="typescript" className="scroll-mt-8 border-b border-zinc-200 py-16">
            <SectionHeading
              eyebrow="Buyer"
              title="Call Verdict with the official x402 V2 client"
              description="The wrapper handles the initial 402 challenge, signs the advertised EVM payment, and retries the request."
            />
            <CodeBlock>npm install @x402/core@2.24 @x402/evm@2.24 @x402/fetch@2.24 viem</CodeBlock>
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
                <span className="font-mono text-xs text-zinc-400">audit.ts</span>
                <CopyCodeButton value={AGENT_BUYER_EXAMPLE} />
              </div>
              <pre className="overflow-x-auto p-5 text-[13px] leading-6 text-zinc-200">
                <code>{AGENT_BUYER_EXAMPLE}</code>
              </pre>
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              Keep <code className="font-mono text-xs">EVM_PRIVATE_KEY</code> in a server-side secret
              manager. Never ship a payer key to browser code, logs, or source control.
            </div>
          </section>

          <section id="http" className="scroll-mt-8 border-b border-zinc-200 py-16">
            <SectionHeading
              eyebrow="Raw HTTP"
              title="Inspect the payment challenge"
              description="This curl command is intentionally unpaid. It demonstrates the initial request and should return HTTP 402 with payment requirements; it does not complete an audit."
            />
            <CodeBlock>{AGENT_UNPAID_CURL_EXAMPLE}</CodeBlock>
          </section>

          <section id="lifecycle" className="scroll-mt-8 border-b border-zinc-200 py-16">
            <SectionHeading
              eyebrow="Lifecycle"
              title="Payment and fulfillment"
              description="Verdict uses x402 V2's challenge-and-retry flow while keeping payment verification ahead of costly audit execution."
            />
            <ol className="grid gap-3 md:grid-cols-2">
              {lifecycle.map((item, index) => (
                <li key={item} className="flex gap-4 rounded-xl border border-zinc-200 p-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-mono text-xs text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-6 text-zinc-700">{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section id="investigation" className="scroll-mt-8 pt-16">
            <SectionHeading
              eyebrow="Product"
              title="What the agent buys"
              description="This is bounded investigation, not an exhaustive crawl. Verdict seeks enough useful evidence to produce a defensible growth-readiness assessment within fixed limits."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {investigation.map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-indigo-600" />
                  <p className="text-sm leading-6 text-zinc-700">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-start gap-3 rounded-xl border border-zinc-200 p-5">
              <CircleDot className="mt-0.5 size-5 shrink-0 text-zinc-500" />
              <p className="text-sm leading-6 text-zinc-600">
                The public response reports pages inspected, coverage, planning rounds, budget use,
                and the stop reason so downstream agents can judge the investigation scope.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
