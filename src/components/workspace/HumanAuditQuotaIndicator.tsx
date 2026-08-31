"use client";

import { useState } from "react";
import { Gauge, ChevronDown } from "lucide-react";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import type { HumanAuditUsageStatus } from "./humanAuditUsageState";

export type HumanAuditQuotaIndicatorProps = {
  usage: HumanAuditUsageState | null;
  status?: HumanAuditUsageStatus;
  compact?: boolean;
  defaultOpen?: boolean;
};

export function remainingDuration(nextAvailableAt: string, nowMs = Date.now()): string {
  const remainingMs = Math.max(0, Date.parse(nextAvailableAt) - nowMs);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function HumanAuditQuotaIndicator({
  usage,
  status = usage ? "ready" : "loading",
  compact = false,
  defaultOpen = false,
}: HumanAuditQuotaIndicatorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const statusCopy = status === "unavailable" ? "unavailable" : "loading";

  if (compact) {
    return (
      <div className="flex flex-col items-center py-1">
        <div
          role="img"
          className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white transition-colors"
          title={usage ? `Usage: ${usage.free.remaining}/${usage.free.limit} free audits` : `Usage: ${statusCopy}`}
          aria-label={usage ? `Usage: ${usage.free.remaining} of ${usage.free.limit} free audits remaining` : `Usage: ${statusCopy}`}
        >
          <Gauge className="size-4" />
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Usage disclosure"
      className="rounded-xl border border-slate-200/70 bg-white/50 p-1.5 dark:border-slate-800/70 dark:bg-slate-900/30 transition-colors"
    >
      <button
        type="button"
        id="sidebar-usage-trigger"
        aria-expanded={isOpen}
        aria-controls="sidebar-usage-details"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-[12.5px] font-medium text-slate-700 hover:bg-slate-200/40 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 dark:focus-visible:ring-white/20"
      >
        <div className="flex items-center gap-2">
          <Gauge className="size-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
          <span>Usage</span>
        </div>
        <ChevronDown
          className={`size-3.5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id="sidebar-usage-details"
        role="region"
        aria-labelledby="sidebar-usage-trigger"
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isOpen
            ? "grid-rows-[1fr] opacity-100 mt-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden space-y-1.5 px-2 pb-1 text-[11.5px]">
          {usage ? (
            <>
              {/* Free audits */}
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Free audits</span>
                <span className="font-medium text-slate-900 dark:text-white tabular-nums">
                  {usage.free.remaining} / {usage.free.limit}
                </span>
              </div>

              {/* Reset timer (if nextAvailableAt exists) */}
              {usage.free.nextAvailableAt ? (
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-500 text-[11px]">
                  <span>Resets in</span>
                  <span className="tabular-nums">
                    {remainingDuration(usage.free.nextAvailableAt)}
                  </span>
                </div>
              ) : null}

              {/* Paid audits */}
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Paid audits</span>
                {usage.paid.available > 0 ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {usage.paid.available} ready
                  </span>
                ) : (
                  <span className="font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                    0
                  </span>
                )}
              </div>
            </>
          ) : status === "unavailable" ? (
            <div className="text-slate-400 dark:text-slate-500">
              Usage unavailable
            </div>
          ) : (
            <div className="text-slate-400 dark:text-slate-500">Loading…</div>
          )}
        </div>
      </div>
    </section>
  );
}
