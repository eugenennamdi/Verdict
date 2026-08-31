"use client";

import { useEffect, useState } from "react";

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS: Record<string, { delays: (number | null)[]; dur: number; round: boolean }> = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots: { delays: chevron, dur: 650, round: true },
  Orbit: { delays: orbit, dur: 950, round: false },
};

export function LoaderGrid({
  delays = chevron,
  dur = 650,
  round = false,
  className = "",
}: {
  delays?: (number | null)[];
  dur?: number;
  round?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={`grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px] ${className}`}>
      {delays.map((delay, index) => (
        <span
          key={index}
          className={`size-[4px] bg-[var(--ink,#0f172a)] dark:bg-[var(--ink,#f8fafc)] motion-reduce:animate-none ${round ? "rounded-full" : "rounded-[1px]"}`}
          style={{
            opacity: delay === null ? 0.07 : 0.15,
            animation: delay === null ? "none" : `pixel-on ${dur}ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

// Alias for backwards compatibility
export const PixelGridLoader = LoaderGrid;

export function useElapsed(startTime?: number | null) {
  const [ds, setDs] = useState(0);

  useEffect(() => {
    const start = startTime || Date.now();
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 100));
      setDs(diff);
    };
    update();
    const t = setInterval(update, 100);
    return () => clearInterval(t);
  }, [startTime]);

  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

type AgentLoadingStateProps = {
  mode?: "audit" | "followup" | "thinking";
  domain?: string;
  startTime?: number | null;
  variant?: string;
};

export function AgentLoadingState({
  mode = "thinking",
  domain,
  startTime,
  variant = "Drive",
}: AgentLoadingStateProps) {
  const elapsed = useElapsed(startTime);
  const { delays, dur, round } = PATTERNS[variant] ?? PATTERNS.Drive;

  const label =
    mode === "audit"
      ? `Investigating ${domain || "startup"}`
      : mode === "followup"
        ? "Reviewing audit evidence"
        : "Thinking";

  const showTimer = mode === "audit" && Boolean(startTime);

  return (
    <div
      role="status"
      className="flex w-fit items-center gap-2.5 py-2 font-sans"
      aria-live="polite"
      aria-label={label}
    >
      <LoaderGrid delays={delays} dur={dur} round={round} />
      <span
        className="bg-clip-text text-[13px] font-medium text-transparent motion-reduce:text-slate-800 motion-reduce:dark:text-slate-200"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--ink-3, #94a3b8) 35%, var(--ink, #0f172a) 50%, var(--ink-3, #94a3b8) 65%)",
          backgroundSize: "200% 100%",
          animation: "shimmer-text 1.4s linear infinite",
        }}
      >
        {label}
      </span>
      {showTimer && (
        <span className="font-mono text-[12px] text-slate-400 dark:text-slate-500 tabular-nums">
          {elapsed}
        </span>
      )}
    </div>
  );
}

export default AgentLoadingState;
