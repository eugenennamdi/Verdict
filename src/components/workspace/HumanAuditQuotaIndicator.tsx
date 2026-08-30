"use client";

import type { HumanAuditQuotaState } from "@/lib/humanAuditQuotaContract";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

type HumanAuditQuotaIndicatorProps = {
  usage: HumanAuditUsageState;
  compact?: boolean;
};

function remainingDuration(nextAvailableAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, Date.parse(nextAvailableAt) - nowMs);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function humanAuditQuotaSecondaryCopy(
  quota: HumanAuditQuotaState,
  nowMs = Date.now()
): string {
  if (quota.remaining > 0 || !quota.nextAvailableAt) {
    return "24h rolling limit";
  }
  return `Resets in ${remainingDuration(quota.nextAvailableAt, nowMs)}`;
}

function QuotaRing({ quota }: { quota: HumanAuditQuotaState }) {
  const remaining = Math.max(0, Math.min(3, quota.remaining));
  const label = `${quota.remaining} of ${quota.limit} free audits remaining`;

  return (
    <span
      role="img"
      aria-label={label}
      className="relative inline-flex size-9 shrink-0 items-center justify-center"
      title={label}
    >
      <svg viewBox="0 0 40 40" className="size-9 -rotate-90" aria-hidden="true">
        {[0, 1, 2].map((segment) => (
          <circle
            key={segment}
            cx="20"
            cy="20"
            r="15"
            fill="none"
            pathLength="100"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="27 73"
            strokeDashoffset={-segment * 33.333}
            className={
              segment < remaining
                ? "text-orange-500"
                : "text-slate-200 dark:text-slate-700"
            }
          />
        ))}
      </svg>
    </span>
  );
}

export function HumanAuditQuotaIndicator({
  usage,
  compact = false,
}: HumanAuditQuotaIndicatorProps) {
  if (compact) {
    return (
      <div
        className="flex flex-col items-center pb-1"
        aria-label="Free audit quota"
      >
        <QuotaRing quota={usage.free} />
      </div>
    );
  }

  return (
    <section
      aria-label="Free audit quota"
      className="mb-2 rounded-xl border border-slate-200/80 bg-white/65 p-2.5 dark:border-slate-800 dark:bg-slate-900/45"
    >
      <div className="flex items-center gap-2.5">
        <QuotaRing quota={usage.free} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Free audits
          </p>
          <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
            {usage.free.remaining} of {usage.free.limit} left
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {humanAuditQuotaSecondaryCopy(usage.free)}
          </p>
          {usage.paid.available > 0 ? (
            <p className="mt-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              1 paid audit ready
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
