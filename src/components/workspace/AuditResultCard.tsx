"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import type { AuditSummary, PillarScore } from "./types";
import {
  auditResultEvidenceLabel,
  successfulEvidenceSources,
} from "./investigationPresentation";

const PILLAR_LABELS: Record<string, string> = {
  positioning: "Positioning",
  messaging: "Messaging",
  website_ux: "Website & UX",
  conversion: "Conversion",
  trust: "Trust",
  competition: "Market & Competition",
  growth_foundation: "Growth Foundation",
};

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-orange-500";
  return "text-rose-600 dark:text-rose-400";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (score >= 50) return "bg-orange-500/10 text-orange-600 border-orange-500/20";
  return "bg-rose-500/10 text-rose-600 border-rose-500/20";
}

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
  const evidenceLabel = auditResultEvidenceLabel(result);
  const evidenceCategories = Array.from(
    new Set(
      successfulEvidenceSources(result.evidence)
        .map((source) => source.category)
        .filter((category): category is NonNullable<typeof category> => Boolean(category))
    )
  );

  return (
    <article
      className="w-full rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 dark:border-slate-800/90 dark:bg-slate-900/90 font-sans"
      aria-label="Audit summary card"
    >
      {/* Header: Company, Eyebrow & Score */}
      <div className="border-b border-slate-100 pb-5 dark:border-slate-800 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">
              Verdict
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {company}
            </h2>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black tabular-nums tracking-tight ${scoreColor(overall)}`}>
                {overall}
              </span>
              <span className="text-[13px] font-bold text-slate-300 dark:text-slate-600">/100</span>
            </div>
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
              Readiness Score
            </span>
          </div>
        </div>

        {desc && (
          <p className="text-[13.5px] text-slate-600 dark:text-slate-400 leading-relaxed pt-0.5">
            {desc}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 font-semibold dark:border-slate-800 dark:bg-slate-800/40">
          {evidenceLabel}
        </span>
        {evidenceCategories.length > 0 && (
          <span>
            Evidence from {evidenceCategories.slice(0, 3).join(", ")}
            {evidenceCategories.length > 3 ? ` +${evidenceCategories.length - 3}` : ""}
          </span>
        )}
      </div>

      {/* Primary Bottleneck Callout */}
      {constraint && (
        <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Primary Bottleneck
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed font-medium text-slate-900 dark:text-slate-100">
            {constraint}
          </p>
        </div>
      )}

      {/* Top Priorities / Recommended Next Moves */}
      {priorities.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between pb-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Recommended Priorities
            </p>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Impact
            </span>
          </div>

          <div className="mt-2.5 space-y-2">
            {priorities.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800/60 dark:bg-slate-800/30"
              >
                <span className="flex size-5.5 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">
                    {item.task}
                  </p>
                  {item.why && (
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.why}
                    </p>
                  )}
                </div>
                {item.impact && (
                  <span className="shrink-0 rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[10.5px] font-bold text-slate-600 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 mt-0.5">
                    {item.impact}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strongest & Weakest Pillar Insight Cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
        {strongest && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Strongest Pillar
            </span>
            <p className="mt-1 text-[13px] font-bold text-slate-900 dark:text-white">
              {strongest.label}
            </p>
          </div>
        )}

        {weakest && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-slate-800/80 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Weakest Pillar
            </span>
            <p className="mt-1 text-[13px] font-bold text-slate-900 dark:text-white">
              {weakest.label}
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onOpenAuditContext}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          <span>Audit Context</span>
        </button>

        {reportId && (
          <Link
            href={`/report/${reportId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-[13px] font-bold text-white shadow-xs hover:bg-orange-600 transition-colors active:scale-[0.98]"
          >
            <span>View Full Report</span>
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
