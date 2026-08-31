"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { AuditSummary, PillarScore } from "./types";

const PILLAR_LABELS: Record<string, string> = {
  positioning: "Positioning",
  messaging: "Messaging",
  website_ux: "Website & UX",
  conversion: "Conversion",
  trust: "Trust",
  competition: "Market & Competition",
  growth_foundation: "Growth Foundation",
};

function rankedPillars(pillars: Record<string, PillarScore> | undefined) {
  if (!pillars) return [];
  return Object.entries(pillars)
    .map(([key, value]) => ({
      key,
      label: PILLAR_LABELS[key] || key,
      score: Number(value?.score || 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function formatImpact(impact: string | undefined): string | undefined {
  if (!impact) return undefined;
  const trimmed = impact.trim();
  if (trimmed.toLowerCase().endsWith("impact")) return trimmed;
  return `${trimmed} impact`;
}

type AuditResultCardProps = {
  result: AuditSummary;
  onOpenAuditContext?: () => void;
};

export function AuditResultCard({ result, onOpenAuditContext }: AuditResultCardProps) {
  const overall = Number(result.overallScore || 0);
  const company = result.identity?.company_name || result.company_name || "Target Startup";
  const desc = result.identity?.inferred_description;
  const reportId = result.reportId;
  const constraint = result.the_verdict?.primary_constraint || result.score_interpretation;
  const priorities = (result.priority_matrix || []).slice(0, 3);
  const ranked = rankedPillars(result.pillars);
  const strongest = ranked[0];
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  return (
    <article
      className="w-full rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs transition-all duration-200 dark:border-slate-800/90 dark:bg-slate-900/90 font-sans divide-y divide-slate-200/70 dark:divide-slate-800/70 space-y-5"
      aria-label="Audit intelligence brief"
    >
      {/* 1. Header: Company Name, Growth Readiness Score & Executive Summary */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white truncate">
              {company}
            </h2>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-slate-950 dark:text-white">
                {overall}
              </span>
              <span className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
                /100
              </span>
            </div>
          </div>
        </div>

        {desc && (
          <p className="mt-2.5 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
            {desc}
          </p>
        )}
      </div>

      {/* 2. Primary Bottleneck */}
      {constraint && (
        <section aria-labelledby="bottleneck-heading" className="pt-5">
          <h3
            id="bottleneck-heading"
            className="text-[12px] font-semibold text-slate-800 dark:text-slate-200"
          >
            Primary bottleneck
          </h3>
          <p className="mt-2 text-[14.5px] font-medium leading-relaxed text-slate-900 dark:text-slate-100">
            {constraint}
          </p>
        </section>
      )}

      {/* 3. Recommended Priorities */}
      {priorities.length > 0 && (
        <section aria-labelledby="priorities-heading" className="pt-5">
          <div className="flex items-center justify-between pb-2">
            <h3
              id="priorities-heading"
              className="text-[12px] font-semibold text-slate-800 dark:text-slate-200"
            >
              Recommended priorities
            </h3>
          </div>

          <ol className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {priorities.map((item, index) => (
              <li key={index} className="py-3.5 first:pt-1 last:pb-0 flex items-start gap-3.5">
                <span className="font-mono text-[13px] font-bold text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4">
                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white leading-snug">
                      {item.task}
                    </p>
                    {item.impact && (
                      <span className="shrink-0 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                        {formatImpact(item.impact)}
                      </span>
                    )}
                  </div>
                  {item.why && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {item.why}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 4. Strongest & Weakest Pillar Comparison */}
      {(strongest || weakest) && (
        <section aria-labelledby="pillars-comparison-heading" className="pt-5">
          <h3 id="pillars-comparison-heading" className="sr-only">
            Pillar comparison
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
            {strongest && (
              <div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Strongest
                </span>
                <p className="mt-1 text-[13.5px] font-semibold text-slate-900 dark:text-white">
                  {strongest.label}
                </p>
              </div>
            )}

            {weakest && (
              <div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                  Weakest
                </span>
                <p className="mt-1 text-[13.5px] font-semibold text-slate-900 dark:text-white">
                  {weakest.label}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. Footer Actions */}
      <div className="pt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenAuditContext}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors active:scale-[0.98]"
        >
          <span>Audit context</span>
        </button>

        {reportId && (
          <Link
            href={`/report/${reportId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-orange-600 transition-colors active:scale-[0.98]"
          >
            <span>View full report</span>
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
