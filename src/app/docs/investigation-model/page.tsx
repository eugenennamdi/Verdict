import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Investigation Model",
  description:
    "How Verdict investigates websites autonomously through bounded discovery, selective gathering, and relevance admission.",
};

export default function InvestigationModelPage() {
  const stages = [
    {
      number: "01",
      title: "Input Validation & Root Acquisition",
      desc: "Verdict verifies the target URL, establishes security boundaries against SSRF, and acquires the raw homepage content.",
    },
    {
      number: "02",
      title: "Identity Normalization",
      desc: "The engine extracts ground-truth company metadata (company name, inferred description, target audience, primary CTA) to anchor the audit.",
    },
    {
      number: "03",
      title: "Bounded Candidate Discovery",
      desc: "Verdict parses internal navigation links to identify high-value candidates across categories (pricing, product, docs, case studies).",
    },
    {
      number: "04",
      title: "Selective Page Gathering",
      desc: "The planning engine selectively fetches the most promising supporting pages up to strict budget and character caps.",
    },
    {
      number: "05",
      title: "Relevance Admission Boundary",
      desc: "Acquired pages undergo an explicit relevance check to confirm they describe the audited entity, discarding unrelated user content or noise.",
    },
    {
      number: "06",
      title: "Evidence-Grounded 7-Pillar Evaluation",
      desc: "The combined, admitted evidence pool is evaluated across the 7 growth dimensions, and the final Growth Readiness Score is calculated via deterministic weighted aggregation.",
    },
    {
      number: "07",
      title: "Persistence & Report Generation",
      desc: "The final structured verdict is persisted in Supabase and delivered as an interactive brief and standalone research report.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          How Verdict Works
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Investigation Model
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict is an autonomous research pipeline that replaces superficial prompt wrappers
          with a disciplined, multi-stage evidence collection and relevance admission engine.
        </p>
      </div>

      {/* Visual Pipeline Diagram (HTML/CSS) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Autonomous Investigation Pipeline
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The investigation proceeds through sequential, bounded verification checkpoints:
        </p>

        <div className="my-6 rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stages.slice(0, 4).map((stage) => (
              <div
                key={stage.number}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-950/60 flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    {stage.number}
                  </span>
                  <h3 className="mt-2 text-xs font-bold text-slate-950 dark:text-white">
                    {stage.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {stages.slice(4).map((stage) => (
              <div
                key={stage.number}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-950/60 flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    {stage.number}
                  </span>
                  <h3 className="mt-2 text-xs font-bold text-slate-950 dark:text-white">
                    {stage.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Bounded vs Exhaustive Crawling */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Bounded Investigation vs. Exhaustive Crawling
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Unlike blind web crawlers that scrape thousands of low-signal URLs, Verdict conducts a
          targeted, bounded investigation. It prioritizes key customer-facing surfaces such as:
        </p>

        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-1">
              Pricing & Tiers
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Evaluates monetization model, trial accessibility, feature gating, and packaging clarity.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-1">
              Product & Features
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Evaluates feature depth, technical screenshots, workflow clarity, and competitive differentiators.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-1">
              Trust & Customers
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Evaluates enterprise credibility, customer logos, verifiable case studies, and testimonials.
            </p>
          </div>
        </div>
      </section>

      <DocsCallout type="note" title="Audit stopping conditions">
        The gatherer stops automatically when evidence coverage reaches sufficiency, planning
        rounds complete, or the bounded budget cap is reached.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Audit follow-ups",
          href: "/docs/audit-follow-ups",
          description: "Grounded conversational Q&A.",
        }}
        next={{
          title: "Evidence & relevance",
          href: "/docs/evidence-and-relevance",
          description: "Separating page acquisition from relevance admission.",
        }}
      />
    </div>
  );
}
