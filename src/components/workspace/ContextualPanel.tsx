"use client";

import { useEffect, useState } from "react";
import {
  X,
  Check,
  Loader2,
  Circle,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/audit/events";
import type { AuditSummary, WorkspacePhase } from "./types";

const AUDIT_PILLARS = [
  {
    key: "positioning_icp",
    title: "1. Positioning & ICP",
    desc: "Razor-sharp ideal customer profile & clarity",
  },
  {
    key: "messaging_copy",
    title: "2. Messaging & Copy",
    desc: "Headline resonance, hierarchy & value clarity",
  },
  {
    key: "ux_friction",
    title: "3. UX & Friction",
    desc: "Time-to-value & low onboarding friction",
  },
  {
    key: "conversion_triggers",
    title: "4. Conversion Triggers",
    desc: "Psychological hook, urgency & ROI promise",
  },
  {
    key: "trust_proof",
    title: "5. Trust & Social Proof",
    desc: "Testimonials, proof markers & case studies",
  },
  {
    key: "defensibility_moat",
    title: "6. Defensibility (Moat)",
    desc: "Proprietary data, network effects & moat",
  },
  {
    key: "growth_foundation",
    title: "7. Growth Foundation",
    desc: "Scalable acquisition loops & growth engines",
  },
];

function formatElapsed(startTime: number | null): string {
  if (!startTime) return "0s";
  const sec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${mins}m ${remSec.toString().padStart(2, "0")}s`;
}

type ContextualPanelProps = {
  phase: WorkspacePhase;
  events: ActivityEvent[];
  startTime: number | null;
  targetUrl?: string;
  targetDomain?: string;
  auditResult?: AuditSummary;
  isOpen: boolean;
  onClose: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function ContextualPanel({
  phase,
  events,
  startTime,
  targetUrl,
  targetDomain,
  auditResult,
  isOpen,
  onClose,
  isMobileOpen,
  onMobileClose,
}: ContextualPanelProps) {
  const [elapsed, setElapsed] = useState("0s");
  const isInvestigating = phase === "investigating";
  const isComplete = phase === "complete";
  const seen = new Set(events.map((event) => event.type));
  const failed = events.some((event) => event.type === "audit.failed");

  useEffect(() => {
    if (!isInvestigating || !startTime) return;
    setElapsed(formatElapsed(startTime));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [isInvestigating, startTime]);

  const hasHomepage = isComplete || seen.has("site.homepage_acquired");
  const hasIdentity = isComplete || seen.has("startup.identified");
  const hasScoring = isComplete || seen.has("scoring.started");
  const hasReport = isComplete || seen.has("report.persisted");
  const isAllComplete = isComplete || seen.has("audit.completed");

  const company = auditResult?.identity?.company_name || auditResult?.company_name || targetDomain || "Startup";
  const identity = auditResult?.identity;
  const evidence = auditResult?.evidence;

  const panelContent = (
    <aside
      className="flex h-full w-[360px] max-w-[90vw] flex-col border-l border-slate-200/80 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-md transition-all duration-200 ease-out font-sans"
      aria-label="Audit context panel"
    >
      {/* Panel Header */}
      <div className="relative flex h-14 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-900 dark:text-white">
            Audit Context
          </span>

          {failed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="size-3" />
              Failed
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onMobileClose?.();
          }}
          className="inline-flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          title="Close panel"
          aria-label="Close audit context panel"
        >
          <X className="size-4" />
        </button>

        {/* Clean Linear Loading Bar when Investigating */}
        {isInvestigating && (
          <>
            <style>{`
              @keyframes shimmerBar {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(350%); }
              }
            `}</style>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{
                  width: "40%",
                  animation: "shimmerBar 1.6s ease-in-out infinite",
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-900 dark:text-slate-100">
        {/* 1. Extracted Startup Context & ICP */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Extracted Context
            </span>
            {targetUrl && (
              <a
                href={targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Open startup website"
              >
                <span>{targetDomain || targetUrl}</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {identity ? (
            <div className="space-y-2 text-[12px]">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Startup Name</span>
                <p className="font-bold text-slate-900 dark:text-white">{company}</p>
              </div>

              {identity.inferred_description && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Value Proposition</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[12px]">
                    {identity.inferred_description}
                  </p>
                </div>
              )}

              {identity.target_audience && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Target ICP</span>
                  <p className="text-slate-700 dark:text-slate-300">{identity.target_audience}</p>
                </div>
              )}

              {identity.primary_cta && (
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Primary CTA</span>
                  <p className="text-slate-900 dark:text-white font-medium">{identity.primary_cta}</p>
                </div>
              )}
            </div>
          ) : isInvestigating ? (
            <div className="space-y-2 py-1">
              <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-3/5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 dark:text-slate-600">Context will appear once investigation begins.</p>
          )}
        </div>

        {/* 2. Seven-Pillar Evaluation Tasks */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Evaluation Process
            </span>
            <span className="text-[10px] font-bold font-mono text-slate-400">7 PILLARS</span>
          </div>

          <ol className="space-y-2">
            {AUDIT_PILLARS.map((pillar) => {
              const isPillarDone = isComplete || hasReport;
              const isPillarActive = isInvestigating && hasScoring && !hasReport;

              return (
                <li
                  key={pillar.key}
                  className="flex items-start gap-2.5 text-[12.5px] rounded-xl p-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/50"
                >
                  <span className="mt-0.5 shrink-0">
                    {isPillarDone ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        <Check className="size-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <Circle className={`size-4 ${isPillarActive ? "text-orange-500" : "text-slate-300 dark:text-slate-700"}`} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <span className={`font-semibold block ${isPillarDone || isPillarActive ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600"}`}>
                      {pillar.title}
                    </span>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                      {pillar.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Panel */}
      {isOpen && (
        <div className="hidden lg:block h-full shrink-0 animate-in slide-in-from-right-4 duration-200">
          {panelContent}
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 shadow-2xl animate-in slide-in-from-right-full duration-200">
            {panelContent}
          </div>
        </div>
      )}
    </>
  );
}

