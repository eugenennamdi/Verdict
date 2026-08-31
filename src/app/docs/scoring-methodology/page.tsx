import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";

export const metadata: Metadata = {
  title: "Scoring Methodology",
  description:
    "Mathematical formula, dimension weights, and evaluation rubric tiers for Verdict's Growth Readiness framework.",
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

  const tiers = [
    {
      score: "0 – 3",
      label: "Critical Failure",
      desc: "Severe absence of necessary elements. The user cannot understand what is sold or who it is for.",
    },
    {
      score: "4 – 6",
      label: "Weak / Generic",
      desc: "Present but generic, jargon-heavy, or leaky. Significant conversion friction and unclear differentiation.",
    },
    {
      score: "7 – 8",
      label: "Competent / Strong",
      desc: "Clear value proposition, solid social proof, and clean user flows. Minor optimizations remain.",
    },
    {
      score: "9 – 10",
      label: "World-Class",
      desc: "Benchmark execution across the industry. Frictionless onboarding, unmistakable positioning, and high moat.",
    },
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
          A transparent look at the mathematical formula, dimension weights, and evaluation
          rubric used to compute the Growth Readiness Score.
        </p>
      </div>

      {/* Mathematical Formula */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Weighting Formula
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Each of the 7 growth dimensions is evaluated on a <strong>0 to 10 scale</strong> based on
          objective evidence. The overall Growth Readiness Score (0–100) is calculated as the
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

      {/* Section: Rubric Tiers */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Evaluation Rubric Tiers (0–10)
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
          {tiers.map((tier) => (
            <div
              key={tier.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-400">{tier.score}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">{tier.label}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                {tier.label}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {tier.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <DocsCallout type="important" title="Elimination of Positivity Bias">
        Verdict uses calibrated rubrics that require concrete, verifiable evidence for high scores.
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
