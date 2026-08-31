import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Recommendations",
  description:
    "How Verdict synthesizes findings into a prioritized action roadmap with estimated impact and effort.",
};

export default function RecommendationsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          How Verdict Works
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Prioritized Recommendations
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          An audit is only valuable if it produces clear, actionable next steps. Verdict synthesizes
          its diagnostic evaluation into a sequenced action roadmap.
        </p>
      </div>

      {/* Section: Prioritization Logic */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Roadmap Sequencing & Prioritization
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Verdict sequences recommendations by addressing the <strong>primary bottleneck first</strong>.
          Every recommendation item is structured with clear operational criteria:
        </p>

        <div className="grid gap-3.5 sm:grid-cols-3 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
              01
            </span>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Action Title
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              A concrete, high-level tactical directive (e.g. &quot;Clarify Hero Headline and Value Proposition&quot;).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
              02
            </span>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Strategic Rationale
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              The diagnostic reasoning explaining why this specific fix will alleviate friction in the conversion funnel.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
              03
            </span>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Impact & Effort Matrix
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Estimated marginal payoff (High / Medium / Low) paired with required engineering/copy effort (Low / Medium / High).
            </p>
          </div>
        </div>
      </section>

      {/* Section: Contextual findings vs guarantees */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Contextual Findings vs. Guaranteed Outcomes
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Recommendations are strategic diagnostic assessments based on the public surface evidence
          collected during the audit. They identify obvious conversion leaks and positioning gaps,
          providing teams with an objective outside perspective.
        </p>

        <DocsCallout type="note" title="Execution in the real world">
          Teams should use Verdict recommendations as high-leverage hypotheses to test and iterate
          against their actual analytics and user interviews.
        </DocsCallout>
      </section>

      <DocsPagination
        prev={{
          title: "Evaluation framework",
          href: "/docs/evaluation-framework",
          description: "The seven core growth dimensions.",
        }}
        next={{
          title: "Agent API Overview",
          href: "/docs/agent-api",
          description: "Programmatic audit endpoint for autonomous agents.",
        }}
      />
    </div>
  );
}
