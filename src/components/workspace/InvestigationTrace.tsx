"use client";

import { Check, Loader2, Circle, AlertCircle } from "lucide-react";
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
};

export function InvestigationTrace({ events, active }: InvestigationTraceProps) {
  const seen = new Set(events.map((event) => event.type));
  const failed = events.some((event) => event.type === "audit.failed");
  const current = ORDER.find((type) => !seen.has(type));

  const rows = ORDER.filter((type) => {
    if (type === "audit.completed" && failed) return false;
    return seen.has(type) || (active && type === current);
  });

  if (failed && !rows.includes("audit.started")) {
    rows.unshift("audit.started");
  }

  return (
    <div
      className="w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-4 dark:border-slate-800/80 dark:bg-slate-900/50"
      aria-live="polite"
      aria-label="Investigation progress"
    >
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Investigation
      </p>
      <ol className="space-y-2.5">
        {rows.map((type) => {
          const done = seen.has(type) && type !== "audit.failed";
          const isCurrent = active && type === current;
          const label = PHASE2_LABELS[type] || type;
          return (
            <li key={type} className="flex items-center gap-3 text-[13px]">
              {done ? (
                <span className="flex size-5 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : isCurrent ? (
                <span className="flex size-5 items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-orange-500 motion-reduce:animate-none" />
                </span>
              ) : (
                <span className="flex size-5 items-center justify-center">
                  <Circle className="size-3.5 text-slate-300 dark:text-slate-700" />
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
        {failed && (
          <li className="flex items-center gap-3 text-[13px] font-medium text-rose-600 dark:text-rose-400">
            <span className="flex size-5 items-center justify-center">
              <AlertCircle className="size-4" />
            </span>
            Investigation failed
          </li>
        )}
      </ol>
    </div>
  );
}
