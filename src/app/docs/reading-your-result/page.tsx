import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Reading Your Result",
  description:
    "How to interpret the inline audit brief, Growth Readiness Score, primary bottleneck, and standalone report.",
};

export default function ReadingYourResultPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Using Verdict
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Reading Your Result
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          A comprehensive breakdown of all the sections in the inline audit card, contextual
          evaluation panel, and standalone intelligence report.
        </p>
      </div>

      {/* Section: Inline Result Overview */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Inline Audit Result Card
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          When an audit finishes, the conversational workspace displays an executive summary card
          containing the primary diagnostic findings:
        </p>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">01</span>
              <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">0–100 Rating</span>
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Growth Readiness Score
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The overall composite index reflecting how ready the company is to deploy capital into
              paid acquisition and scale growth loops without excessive funnel friction.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">02</span>
              <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">Ground Truth</span>
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Company Profile & Inferred Description
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Verdict extracts the de-fluffed truth about the business: what the product actually does,
              who the true target audience is, and what primary call-to-action is offered.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">03</span>
              <span className="font-mono text-xs font-semibold text-orange-600 dark:text-orange-400">Critical Constraint</span>
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Primary Bottleneck
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The single highest-impact constraint currently inhibiting user conversion or growth.
              Fixing this bottleneck yields the highest marginal return on effort.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">04</span>
              <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">Action Roadmap</span>
            </div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Recommended Priorities
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              A ranked sequence of actionable tactical improvements with clear rationale and
              estimated Impact (High / Medium / Low) and Effort (Low / Medium / High).
            </p>
          </div>
        </div>
      </section>

      {/* Section: Standalone Full Report */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Standalone Full Report
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Clicking <strong>View full report ↗</strong> opens the deep-dive research memo.
          This standalone view is designed as an executive intelligence brief:
        </p>

        <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Growth Readiness Analysis
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Seven sequential chapters evaluating every dimension in detail with narrative context,
              highlighting concrete strengths (<em>What works</em>) and friction points (<em>Areas to improve</em>).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Persistent & Shareable
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Includes a restrained bottom dock allowing you to copy a permanent link, save the
              report locally, or share it directly with stakeholders.
            </p>
          </div>
        </div>
      </section>

      <DocsCallout type="note" title="Single unified score">
        Following Verdict&apos;s product refinement, individual pillar score numbers have been
        subsumed into the overall Growth Readiness Score at the top, focusing attention on the
        qualitative diagnosis and concrete action items.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Running an audit",
          href: "/docs/running-an-audit",
          description: "Inputs, duration, and error handling.",
        }}
        next={{
          title: "Growth Readiness Score",
          href: "/docs/growth-readiness-score",
          description: "Understanding the 0-100 metric and dimension weighting.",
        }}
      />
    </div>
  );
}
