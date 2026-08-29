"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  ExternalLink,
  Cpu,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/audit/events";

type GroundedTelemetryCardProps = {
  domain?: string;
  events?: ActivityEvent[];
  latency?: string;
  model?: string;
  defaultExpanded?: boolean;
};

export function GroundedTelemetryCard({
  domain,
  events = [],
  latency = "14.2s",
  model = "gemini-2.5-flash",
  defaultExpanded = false,
}: GroundedTelemetryCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "") : "startup.com";

  return (
    <div className="w-full space-y-2.5 font-sans">
      {/* Header Pill */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1 text-[12px] font-semibold text-slate-700 shadow-2xs hover:border-slate-300 dark:border-slate-800/90 dark:bg-slate-900/90 dark:text-slate-300 transition-colors"
      >
        <span className="flex size-3.5 items-center justify-center text-orange-500">
          <Cpu className="size-3.5" />
        </span>
        <span>Grounded Intelligence</span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">·</span>
        <span className="text-slate-500 dark:text-slate-400 font-normal">2 tools · 1 source</span>
        {isExpanded ? (
          <ChevronUp className="size-3.5 text-slate-400 ml-0.5" />
        ) : (
          <ChevronDown className="size-3.5 text-slate-400 ml-0.5" />
        )}
      </button>

      {/* Expanded Telemetry Box */}
      {isExpanded && (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-900/40 space-y-4 text-slate-900 dark:text-slate-100 animate-in fade-in-50 duration-150">
          {/* Section 1: Executed Tools & Reasoning Telemetry */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Executed Tools & Reasoning Telemetry
            </p>

            <div className="space-y-2">
              {/* Tool 1: Context Normalization & Ingestion */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 bg-white p-3 dark:border-slate-800/60 dark:bg-slate-900/70">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 dark:text-white font-mono">
                      Context Normalization & Ingestion
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Scraped full DOM via Firecrawl Web Engine
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                  Complete
                </span>
              </div>

              {/* Tool 2: 7-Pillar Growth Readiness Evaluation */}
              <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 bg-white p-3 dark:border-slate-800/60 dark:bg-slate-900/70">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 dark:text-white font-mono">
                      7-Pillar Growth Readiness Evaluation
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Evaluated Positioning, Copy, UX Friction, Conversion Triggers, Trust, Moat & Growth Loops
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
                  Complete
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Data Sources */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Data Sources
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://${cleanDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 shadow-2xs hover:border-orange-500/50 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors"
              >
                <span>{cleanDomain}</span>
                <ExternalLink className="size-3 text-slate-400" />
              </a>

              <a
                href="https://firecrawl.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 shadow-2xs hover:border-orange-500/50 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors"
              >
                <span>Firecrawl API</span>
                <ExternalLink className="size-3 text-slate-400" />
              </a>
            </div>
          </div>

          {/* Section 3: Model & Latency Footer */}
          <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-[12px] text-slate-500 dark:border-slate-800/60 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span>Model</span>
              <span>·</span>
              <span className="rounded-md bg-slate-200/70 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {model}
              </span>
            </div>

            <span className="font-mono text-[11.5px] text-slate-400 dark:text-slate-500">
              {latency} latency
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
