import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Compass, Cpu, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "Overview of Verdict, the autonomous growth intelligence platform and programmatic audit API.",
};

export default function DocsIntroPage() {
  return (
    <div className="space-y-12">
      {/* Page Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Getting Started
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Introduction to Verdict
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict is autonomous growth intelligence for startups and software companies.
          It investigates a company&apos;s public surface, builds an evidence-backed
          understanding of the business, evaluates its growth readiness across a
          deterministic framework, and identifies the primary bottleneck holding it back.
        </p>
      </div>

      {/* Core Concept Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white mb-4">
            <Compass className="size-5" />
          </div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white mb-2">
            Human Workspace
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            A conversational product surface where founders, investors, and operators submit a
            startup URL, receive a structured Growth Readiness audit, review the full report,
            and ask grounded follow-up questions.
          </p>
          <Link
            href="/docs/quickstart"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
          >
            <span>Read human quickstart</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white mb-4">
            <Bot className="size-5" />
          </div>
          <h2 className="text-base font-bold text-slate-950 dark:text-white mb-2">
            Agent API (x402)
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            A machine-to-machine HTTP endpoint (<code>POST /api/v2/audit</code>) enabling
            autonomous software agents to pay for and consume structured growth audits
            programmatically using USDC on Base.
          </p>
          <Link
            href="/docs/agent-api"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
          >
            <span>Explore Agent API</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Section: What Verdict Does */}
      <section className="space-y-4 pt-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
          What happens when you submit a URL?
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          When an audit begins—whether triggered by a human in the workspace or an agent via
          the API—Verdict executes a disciplined, bounded investigation pipeline:
        </p>

        <ol className="mt-4 space-y-3.5 pl-0">
          {[
            {
              step: "01",
              title: "Primary evidence acquisition",
              detail:
                "Verdict acquires the startup homepage, validates URL reachability, and extracts clean ground-truth text.",
            },
            {
              step: "02",
              title: "Normalized identity extraction",
              detail:
                "The engine de-fluffs marketing jargon to establish ground truth: company name, target audience, core value proposition, and primary call-to-action.",
            },
            {
              step: "03",
              title: "Bounded candidate discovery & selective gathering",
              detail:
                "Verdict discovers high-signal supporting pages (e.g. pricing, product features, documentation, case studies) without executing an unbounded site crawl.",
            },
            {
              step: "04",
              title: "Relevance admission boundary",
              detail:
                "Fetched pages must pass an explicit entity relevance test before contributing to the audit, ensuring noise and third-party embeds are discarded.",
            },
            {
              step: "05",
              title: "Deterministic 7-pillar evaluation",
              detail:
                "The combined evidence is graded across seven foundational growth dimensions to compute a single Growth Readiness Score (0–100).",
            },
            {
              step: "06",
              title: "Synthesis & prioritized recommendations",
              detail:
                "Verdict isolates the primary growth bottleneck and outputs a prioritized action roadmap with estimated impact and effort.",
            },
          ].map((item) => (
            <li
              key={item.step}
              className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs"
            >
              <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 pt-0.5">
                {item.step}
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Section: Core Tenets */}
      <section className="space-y-4 pt-2">
        <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
          Design & Engineering Principles
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Deterministic Scoring
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              The overall Growth Readiness Score is derived mathematically from weighted
              rubric dimensions, not generated as an arbitrary LLM number.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Evidence-First
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Every finding is grounded in public surface evidence. Unsupported assertions
              and unverified claims are filtered out.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Non-Custodial
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Verdict does not store user funds, take custody of wallets, or execute
              transactions automatically without explicit authorization.
            </p>
          </div>
        </div>
      </section>

      <DocsCallout type="note" title="Need to integrate an agent?">
        If you are building an autonomous agent or workflow, head over to the{" "}
        <Link href="/docs/agent-api" className="font-semibold text-orange-600 dark:text-orange-400 hover:underline">
          Agent API Overview
        </Link>{" "}
        to review the request contract and x402 payment specifications.
      </DocsCallout>

      <DocsPagination
        next={{
          title: "Quickstart",
          href: "/docs/quickstart",
          description: "Run your first audit in 6 simple steps.",
        }}
      />
    </div>
  );
}
