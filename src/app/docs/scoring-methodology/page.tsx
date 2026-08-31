import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";

export const metadata: Metadata = {
  title: "Scoring Methodology",
  description:
    "Mathematical formula, dimension weights, and structured evaluation framework for Verdict's Growth Readiness Score.",
};

export default function ScoringMethodologyPage() {
  const dimensions = [
    { key: "positioning", name: "Positioning & ICP", weight: 0.20, pct: "20%" },
    { key: "messaging", name: "Messaging & Copy", weight: 0.15, pct: "15%" },
    { key: "website_ux", name: "Website & UX", weight: 0.15, pct: "15%" },
    { key: "conversion", name: "Conversion Triggers", weight: 0.15, pct: "15%" },
    { key: "trust", name: "Trust & Social Proof", weight: 0.10, pct: "10%" },
    { key: "competition", name: "Defensibility", weight: 0.10, pct: "10%" },
    { key: "growth_foundation", name: "Growth Foundation", weight: 0.15, pct: "15%" },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Reference
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Scoring Methodology
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          A transparent look at the mathematical formula, dimension weights, and structured evaluation
          framework used to compute the Growth Readiness Score.
        </p>
      </div>

      {/* Mathematical Formula */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Weighting Formula
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The overall Growth Readiness Score is calculated using fixed weights applied to structured
          dimension evaluations. The aggregation formula is deterministic: the same dimension
          evaluations produce the same overall score.
        </p>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Each of the 7 growth dimensions is evaluated across a <strong>0 to 100 range</strong> based on
          admitted evidence. The overall Growth Readiness Score (0–100) is calculated as the
          weighted sum rounded to the nearest integer:
        </p>

        <DocsCodeBlock language="typescript" filename="Formula">
{`Overall Score = Math.round(
  Positioning * 0.20 +
  Messaging   * 0.15 +
  WebsiteUX   * 0.15 +
  Conversion  * 0.15 +
  Trust       * 0.10 +
  Defensibility * 0.10 +
  GrowthFoundation * 0.15
)`}
        </DocsCodeBlock>
      </section>

      {/* Dimension Weights Table */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Fixed Dimension Weights
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Dimension Key</th>
                <th className="px-5 py-3.5 font-semibold">Display Name</th>
                <th className="px-5 py-3.5 font-semibold text-center w-24">Multiplier</th>
                <th className="px-5 py-3.5 font-semibold text-center w-24">Weight (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {dimensions.map((dim) => (
                <tr key={dim.key}>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {dim.key}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-950 dark:text-white">
                    {dim.name}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-center font-bold text-slate-900 dark:text-slate-100">
                    {dim.weight.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-center font-bold text-orange-600 dark:text-orange-400">
                    {dim.pct}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section: Structured Dimension Evaluation */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Structured Dimension Evaluation & Deterministic Aggregation
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The underlying dimension evaluations are produced by Verdict&apos;s structured audit grader
          from admitted website evidence. Each dimension assessment is validated through schema
          enforcement before contributing to score aggregation.
        </p>
        <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Evidence-Grounded Inputs
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Dimension assessments require concrete, verifiable evidence from admitted pages.
              Unsubstantiated claims and generic marketing copy receive lower marks by design.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
              Single Public Numeric Score
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Individual dimension numeric values remain internal for weighted aggregation and relative
              ranking. The public report surfaces one composite Growth Readiness Score alongside deep
              qualitative analysis.
            </p>
          </div>
        </div>
      </section>

      <DocsCallout type="important" title="Elimination of Positivity Bias">
        Verdict uses calibrated evaluation criteria that require concrete, verifiable evidence for high scores.
        Empty marketing claims, generic stock images, and unquantified buzzwords receive low marks
        by design.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Reliability",
          href: "/docs/reliability",
          description: "Execution caps and fail-closed safety.",
        }}
        next={{
          title: "Limits & usage",
          href: "/docs/limits",
          description: "Free quotas and paid entitlements.",
        }}
      />
    </div>
  );
}
