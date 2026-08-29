"use client";

import { useState } from "react";
import { Check, Loader2, Circle, AlertCircle, ChevronDown, ChevronUp, Activity } from "lucide-react";
import type { ActivityEvent, ActivityEventType } from "@/lib/audit/events";

const PHASE2_LABELS: Partial<Record<ActivityEventType, string>> = {
  "audit.started": "Investigation started",
  "site.homepage_acquired": "Homepage acquired",
  "startup.identified": "Startup identified",
  "scoring.started": "Evaluating growth readiness",
  "report.persisted": "Preparing report",
  "audit.completed": "Investigation complete",
  "audit.failed": "Investigation failed",
};

const ORDER: ActivityEventType[] = [
  "audit.started",
  "site.homepage_acquired",
  "startup.identified",
  "scoring.started",
  "report.persisted",
  "audit.completed",
];

type InvestigationTraceProps = {
  events: ActivityEvent[];
  active: boolean;
  domain?: string;
  onOpenPanel?: () => void;
};

export function InvestigationTrace({
  events,
  active,
  domain,
  onOpenPanel,
}: InvestigationTraceProps) {
  const [expanded, setExpanded] = useState(false);
  const seen = new Set(events.map((event) => event.type));
  const failed = events.some((event) => event.type === "audit.failed");
  const current = ORDER.find((type) => !seen.has(type));

  const latestEvent = events[events.length - 1];
  const activeLabel = current ? (PHASE2_LABELS[current] || current) : (latestEvent ? (PHASE2_LABELS[latestEvent.type] || latestEvent.message) : "Investigation started");

  const rows = ORDER.filter((type) => {
    if (type === "audit.completed" && failed) return false;
    return seen.has(type) || (active && type === current);
  });

  if (failed && !rows.includes("audit.started")) {
    rows.unshift("audit.started");
  }

  // Active state: sleek live agent activity card
  if (active) {
    return (
      <div
        className="w-full rounded-2xl border border-orange-500/20 bg-orange-500/5 px-4 py-3.5 transition-all dark:border-orange-500/20 dark:bg-orange-500/5"
        aria-live="polite"
        aria-label="Investigation progress"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Loader2 className="size-4 animate-spin text-orange-500 shrink-0 motion-reduce:animate-none" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
                  Auditing
                </span>
                {domain && (
                  <span className="truncate text-[12px] font-bold text-slate-900 dark:text-white">
                    {domain}
                  </span>
                )}
              </div>
              <p className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-300">
                {activeLabel}...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenPanel && (
              <button
                type="button"
                onClick={onOpenPanel}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs border border-slate-200/80 hover:border-orange-500/50 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors"
              >
                <Activity className="size-3 text-orange-500" />
                <span>Runtime Panel</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="lg:hidden inline-flex items-center gap-1 rounded-lg p-1 text-slate-500 hover:bg-slate-200/50 dark:text-slate-400"
              aria-expanded={expanded}
              aria-label="Toggle task details"
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {/* Mobile / expanded inline step list */}
        {expanded && (
          <ol className="mt-3.5 space-y-2 border-t border-orange-500/15 pt-3">
            {rows.map((type) => {
              const done = seen.has(type) && type !== "audit.failed";
              const isCurrent = active && type === current;
              const label = PHASE2_LABELS[type] || type;
              return (
                <li key={type} className="flex items-center gap-2.5 text-[12px]">
                  {done ? (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  ) : isCurrent ? (
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <Loader2 className="size-3 animate-spin text-orange-500 motion-reduce:animate-none" />
                    </span>
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <Circle className="size-2.5 text-slate-300 dark:text-slate-700" />
                    </span>
                  )}
                  <span
                    className={
                      done || isCurrent
                        ? "font-medium text-slate-900 dark:text-white"
                        : "text-slate-400 dark:text-slate-600"
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  }

  // Completed/Historical trace: minimal collapsible card
  return (
    <div
      className="w-full rounded-xl border border-slate-200/80 bg-white/60 px-3.5 py-2.5 text-[12px] dark:border-slate-800/80 dark:bg-slate-900/40"
      aria-label="Investigation trace summary"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Investigation complete
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-400">1 page inspected</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          <span>{expanded ? "Hide tasks" : "Show tasks"}</span>
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
      </div>

      {expanded && (
        <ol className="mt-3 space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
          {rows.map((type) => {
            const done = seen.has(type) && type !== "audit.failed";
            const label = PHASE2_LABELS[type] || type;
            return (
              <li key={type} className="flex items-center gap-2.5 text-[12px]">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

