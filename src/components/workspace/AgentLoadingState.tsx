"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { VerdictLogo } from "./AppSidebar";

type AgentLoadingStateProps = {
  mode: "audit" | "thinking";
  domain?: string;
  startTime?: number | null;
};

export function AgentLoadingState({
  mode,
  domain,
  startTime,
}: AgentLoadingStateProps) {
  const [seconds, setSeconds] = useState("0.0s");

  useEffect(() => {
    const start = startTime || Date.now();
    const update = () => {
      const diff = Math.max(0, (Date.now() - start) / 1000);
      setSeconds(`${diff.toFixed(1)}s`);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  const label =
    mode === "audit"
      ? `Investigating ${domain || "startup"}`
      : "Reviewing audit evidence";

  return (
    <div
      className="flex items-center gap-3 py-2 font-sans"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex size-5 shrink-0 items-center justify-center text-orange-500">
        <VerdictLogo className="size-4" />
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-slate-400 dark:text-slate-500 motion-reduce:animate-none" />
        <span className="truncate text-[13.5px] font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
        <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-slate-400 dark:text-slate-500">
          {seconds}
        </span>
      </div>
    </div>
  );
}
