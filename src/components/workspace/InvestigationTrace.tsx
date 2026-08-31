"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/audit/events";
import { PixelGridLoader } from "./AgentLoadingState";
import {
  inspectedPageCountFromEvents,
  presentActivityEvents,
} from "./investigationPresentation";

type InvestigationTraceProps = {
  events: ActivityEvent[];
  active: boolean;
  domain?: string;
};

export function InvestigationTrace({
  events,
  active,
  domain,
}: InvestigationTraceProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = presentActivityEvents(events);
  const latest = rows.at(-1);
  const pagesInspected = inspectedPageCountFromEvents(events);
  const pageLabel = `${pagesInspected} page${pagesInspected === 1 ? "" : "s"} inspected`;

  const inlineRows = (
    <ol className="mt-3.5 space-y-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
      {rows.map((row, index) => (
        <li key={`${row.type}-${index}`} className="flex items-start gap-2.5 text-[12px]">
          {row.tone === "failed" || row.tone === "warning" ? (
            <AlertCircle
              className={`mt-0.5 size-4 shrink-0 ${
                row.tone === "failed" ? "text-rose-500" : "text-amber-500"
              }`}
            />
          ) : row.tone === "active" && active && index === rows.length - 1 ? (
            <PixelGridLoader className="mt-1" />
          ) : (
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block font-medium text-slate-900 dark:text-white">
              {row.label}
            </span>
            {row.detail && (
              <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                {row.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );

  if (active) {
    return (
      <div
        className="w-full py-2.5 font-sans"
        aria-live="polite"
        aria-label="Investigation progress"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80">
          <div className="flex min-w-0 items-center gap-2.5">
            <PixelGridLoader />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0 text-[13px]">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900 dark:text-white">
                Auditing
              </span>
              {domain && (
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {domain}
                </span>
              )}
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {pageLabel}
              </span>
              {latest?.label && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="truncate text-slate-500 dark:text-slate-400">
                    {latest.label}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((previous) => !previous)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
              aria-expanded={expanded}
              aria-label="Toggle activity details"
            >
              <span>{expanded ? "Hide" : "Details"}</span>
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>
        </div>
        {expanded && <div className="lg:hidden pt-1">{inlineRows}</div>}
      </div>
    );
  }

  return null;
}
