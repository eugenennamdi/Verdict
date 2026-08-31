import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Growth Readiness Score",
  description:
    "Mathematical formula, dimension weights, and qualitative score interpretation for Verdict's Growth Readiness Score.",
};

export default function GrowthReadinessScorePage() {
  const dimensions = [
    {
      name: "Positioning & ICP",
      weight: "20%",
      role: "Clarity of target customer profile, use case boundaries, and core market wedge.",
    },
    {
      name: "Messaging & Copy",
      weight: "15%",
      role: "Value clarity, headline resonance, absence of jargon, and concrete product explanation.",
    },
    {
      name: "Website & UX",
      weight: "15%",
      role: "Time-to-value, visual hierarchy, mobile polish, and onboarding friction.",
    },
    {
      name: "Conversion Triggers",
      weight: "15%",
      role: "Compelling call-to-action hooks, risk reversal, ROI promises, and urgency triggers.",
    },
    {
      name: "Trust & Social Proof",
      weight: "10%",
      role: "Customer logos, verifiable case studies, quantitative metrics, and credibility signals.",
    },
    {
      name: "Defensibility",
      weight: "10%",
      role: "Proprietary technology, moat, network effects, or unique structural advantages.",
    },
    {
      name: "Growth Foundation",
      weight: "15%",
      role: "Organic acquisition loops, referral mechanics, content foundations, and scalability.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Using Verdict
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Growth Readiness Score
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          The Growth Readiness Score is a composite index (0–100) that evaluates a company&apos;s
          readiness to scale customer acquisition, convert traffic efficiently, and deploy capital.
        </p>
      </div>

      {/* Section: Deterministic Nature */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Deterministic Mathematical Weighting
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The overall Growth Readiness Score is calculated using fixed weights applied to structured
          dimension evaluations. The aggregation formula is deterministic: the same dimension
          evaluations produce the same overall score.
        </p>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Dimension evaluations are evidence-grounded model assessments validated through Verdict&apos;s
          structured audit pipeline, which are then aggregated mathematically using fixed weights:
        </p>

        {/* Weights Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs mt-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Growth Dimension</th>
                <th className="px-5 py-3.5 font-semibold text-center w-28">Weight</th>
                <th className="px-5 py-3.5 font-semibold">Core Focus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {dimensions.map((dim) => (
                <tr key={dim.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="px-5 py-3.5 font-semibold text-slate-950 dark:text-white">
                    {dim.name}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-center font-bold text-slate-900 dark:text-slate-100">
                    {dim.weight}
                  </td>
                  <td className="px-5 py-3.5 text-xs sm:text-[13px] text-slate-600 dark:text-slate-400">
                    {dim.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section: Score Interpretation */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Score Interpretation & Qualitative Breakdown
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The Growth Readiness Score represents a single unified diagnostic metric (0–100). Rather than
          imposing artificial score tiers or arbitrary tier labels, Verdict pairs the overall numerical
          rating with detailed qualitative analysis:
        </p>

        <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Primary Bottleneck Synthesis
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Isolates the single most critical constraint holding back customer acquisition or conversion,
              pinpointing where immediate intervention will yield the highest return.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Qualitative Dimension Diagnostics
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              In-depth assessment across all 7 growth dimensions highlighting concrete strengths
              (<em>What works</em>) and specific friction points (<em>Areas to improve</em>).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Actionable Priority Matrix
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              A ranked sequence of tactical improvements with explicit strategic rationale, estimated
              marginal impact, and implementation effort.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Grounded Narrative Interpretation
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              A narrative explanation of what the score indicates about the startup&apos;s current
              commercial surface and scalability readiness.
            </p>
          </div>
        </div>
      </section>

      <DocsCallout type="important" title="Not an absolute verdict on company survival">
        The score measures the commercial and growth readiness of the public website surface.
        It is a diagnostic tool designed to highlight high-leverage growth bottlenecks, not an
        absolute predictor of long-term startup outcome.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Reading your result",
          href: "/docs/reading-your-result",
          description: "Navigating the inline summary and standalone report.",
        }}
        next={{
          title: "Audit follow-ups",
          href: "/docs/audit-follow-ups",
          description: "Grounded conversational Q&A against audit context.",
        }}
      />
    </div>
  );
}
