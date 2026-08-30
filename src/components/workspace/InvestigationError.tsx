"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { publicInvestigationErrorMessage } from "@/lib/audit/publicError";

type InvestigationErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function InvestigationError({ message, onRetry }: InvestigationErrorProps) {
  const safeMessage = publicInvestigationErrorMessage(message);
  return (
    <div className="w-full rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
          <AlertCircle className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-bold text-slate-900 dark:text-white">
            Investigation couldn&apos;t continue
          </h4>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {safeMessage}
          </p>

          {onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white transition-colors"
              >
                <RefreshCw className="size-3" />
                <span>Try another URL</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
