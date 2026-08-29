"use client";

import { useEffect, useState } from "react";
import { VerdictLogo } from "./AppSidebar";

export function PixelGridLoader({ className = "size-3.5" }: { className?: string }) {
  const pixels = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className={`grid grid-cols-3 gap-[2px] ${className}`} aria-hidden="true">
      {pixels.map((i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const delay = (row + col) * 0.15;
        return (
          <span
            key={i}
            className="size-[3.5px] rounded-[0.5px] bg-slate-800 dark:bg-slate-200"
            style={{
              animation: "pixelWave 1.4s ease-in-out infinite",
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

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
      ? `Running an audit on ${domain || "startup"}`
      : "Thinking";

  return (
    <>
      <style>{`
        @keyframes pixelWave {
          0%, 100% {
            opacity: 0.25;
            transform: scale(0.88);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes textShimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
        .animate-text-shimmer {
          background-size: 200% 100%;
          animation: textShimmer 2.2s linear infinite;
        }
      `}</style>

      <div className="flex items-center gap-2.5 py-1.5 font-sans" aria-live="polite">
        {/* Brand Icon */}
        <div className="flex size-4 shrink-0 items-center justify-center text-orange-500">
          <VerdictLogo className="size-3.5" />
        </div>

        {/* 3x3 Pixel Grid Loader */}
        <div className="flex items-center justify-center shrink-0">
          <PixelGridLoader />
        </div>

        {/* Shimmer Text & Elapsed Timer */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[13.5px] font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-400 to-slate-900 dark:from-white dark:via-slate-400 dark:to-white animate-text-shimmer truncate">
            {label}
          </span>
          <span className="text-[12.5px] font-normal text-slate-400 dark:text-slate-500 font-sans tabular-nums shrink-0">
            {seconds}
          </span>
        </div>
      </div>
    </>
  );
}
