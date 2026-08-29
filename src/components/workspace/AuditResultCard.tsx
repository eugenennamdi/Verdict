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

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-orange-500";
  return "text-rose-600 dark:text-rose-400";
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
};

export function AuditResultCard({ result }: AuditResultCardProps) {
  const score = Number(result.overallScore || 0);
  const company = result.identity?.company_name || result.company_name || "Startup";
  const ranked = rankedPillars(result.pillars);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const priorities = (result.priority_matrix || []).slice(0, 3);
  const pages = result.evidence?.length || 1;
  const reportId = result.reportId;

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Growth Readiness
          </p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">
            {company}
          </h3>
        </div>
        <div className="text-right">
          <span className={`text-4xl font-black tracking-tighter ${scoreColor(score)}`}>
            {score}
          </span>
          <span className="text-sm font-bold text-slate-300 dark:text-slate-600">/100</span>
        </div>
      </div>

      {result.the_verdict?.primary_constraint && (
        <p className="mt-4 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Primary bottleneck. </span>
          {result.the_verdict.primary_constraint}
        </p>
      )}

      {priorities.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Top priorities
          </p>
          <ol className="mt-2 space-y-1.5">
            {priorities.map((item, index) => (
              <li key={index} className="text-[13px] leading-snug text-slate-700 dark:text-slate-300">
                <span className="mr-2 font-black text-slate-400">{index + 1}.</span>
                {item.task}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
        {strongest && (
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Strongest</p>
            <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
              {strongest.label} · {strongest.score}
            </p>
          </div>
        )}
        {weakest && (
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weakest</p>
            <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
              {weakest.label} · {weakest.score}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-[12px] text-slate-400">
          {pages} page inspected
        </p>
        {reportId ? (
          <Link
            href={`/report/${reportId}`}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-orange-500 hover:text-orange-600"
          >
            Full report
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
