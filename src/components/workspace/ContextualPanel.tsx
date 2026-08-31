"use client";

import { useEffect, useState } from "react";
import {
  X,
  Check,
  Circle,
  AlertCircle,
  ExternalLink,
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
  const isFailed = phase === "failed" || events.some((event) => event.type === "audit.failed");
  const isComplete = !isFailed && phase === "complete";
  const isInvestigating = !isFailed && phase === "investigating";
  const seen = new Set(events.map((event) => event.type));

  useEffect(() => {
    if (!isInvestigating || !startTime) return;
    setElapsed(formatElapsed(startTime));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [isInvestigating, startTime]);

  const hasReport = isComplete || seen.has("report.persisted");

  const company = auditResult?.identity?.company_name || auditResult?.company_name || targetDomain || "Startup";
  const identity = auditResult?.identity;
  const hasIdentity = Boolean(
    identity?.company_name ||
    identity?.inferred_description ||
    identity?.target_audience ||
    identity?.primary_cta
  );

  /* 1. Company Context Group */
  const contextSection = (hasIdentity || (isInvestigating && !isFailed)) && (
    <section
      aria-labelledby="section-context"
      className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/80"
    >
      <div className="flex items-center justify-between pb-2">
        <h3
          id="section-context"
          className="text-[12.5px] font-semibold text-slate-900 dark:text-white"
        >
          Company Profile
        </h3>
        {targetUrl && (
          <a
            href={targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            title="Open startup website"
            aria-label={`Open website for ${targetDomain || targetUrl}`}
          >
            <span className="max-w-[110px] truncate">{targetDomain || targetUrl}</span>
            <ExternalLink className="size-2.5 shrink-0" />
          </a>
        )}
      </div>

      {identity ? (
        <dl className="space-y-2 text-[12px]">
          <div>
            <dt className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Startup</dt>
            <dd className="font-semibold text-slate-900 dark:text-white">{company}</dd>
          </div>

          {identity.inferred_description && (
            <div>
              <dt className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Value proposition</dt>
              <dd className="leading-relaxed text-slate-800 dark:text-slate-200">
                {identity.inferred_description}
              </dd>
            </div>
          )}

          {identity.target_audience && (
            <div>
              <dt className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Target ICP</dt>
              <dd className="leading-relaxed text-slate-800 dark:text-slate-200">{identity.target_audience}</dd>
            </div>
          )}

          {identity.primary_cta && (
            <div>
              <dt className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Primary CTA</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{identity.primary_cta}</dd>
            </div>
          )}
        </dl>
      ) : isInvestigating ? (
        <div className="space-y-2 py-1" aria-hidden="true">
          <div className="h-3 w-4/5 rounded bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="h-3 w-3/5 rounded bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="h-3 w-2/3 rounded bg-slate-200/60 dark:bg-slate-800/60" />
        </div>
      ) : null}
    </section>
  );

  /* 2. Evaluation Group */
  const evaluationSection = !isFailed && (
    <section
      aria-labelledby="section-evaluation"
      className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/80"
    >
      <div className="pb-2">
        <h3
          id="section-evaluation"
          className="text-[12.5px] font-semibold text-slate-900 dark:text-white"
        >
          Evaluation
        </h3>
      </div>

      <ol className="space-y-2 pt-0.5">
        {AUDIT_PILLARS.map((pillar) => {
          const isPillarDone = isComplete || hasReport;

          return (
            <li key={pillar.key} className="flex items-start gap-2 text-[12px]">
              <span className="mt-0.5 shrink-0">
                {isPillarDone ? (
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    <Check className="size-2 stroke-[3]" />
                  </span>
                ) : (
                  <Circle className="size-3.5 text-slate-300 dark:text-slate-700" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <span
                  className={`block font-medium ${
                    isPillarDone
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {pillar.title}
                </span>
                <p className="leading-snug text-[11px] text-slate-500 dark:text-slate-400">
                  {pillar.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );

  const panelContent = (
    <aside
      className="flex h-full w-[340px] xl:w-[360px] max-w-[90vw] flex-col border-l border-slate-200/80 bg-slate-100/60 dark:border-slate-800/80 dark:bg-slate-950 transition-[width,transform] duration-200 ease-out font-sans select-text"
      aria-label="Audit context"
    >
      {/* Panel Header */}
      <div className="flex h-13 items-center justify-between border-b border-slate-200/80 bg-white/80 dark:bg-slate-950/80 px-4 dark:border-slate-800/80 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold tracking-tight text-slate-950 dark:text-white">
            Audit Context
          </h2>

          {isInvestigating && (
            <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {elapsed}
            </span>
          )}

          {isFailed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-600 dark:text-rose-400">
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
          className="inline-flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 active:scale-[0.96] dark:text-slate-500 dark:hover:bg-slate-800/80 dark:hover:text-white dark:focus-visible:ring-white/20"
          title="Close audit context"
          aria-label="Close audit context"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Panel Body: Company Context and Evaluation */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-slate-900 dark:text-slate-100">
        {contextSection}
        {evaluationSection}
        {!contextSection && !evaluationSection && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 text-center dark:border-slate-800/80 dark:bg-slate-900/80">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              {isFailed ? "Audit could not continue." : "Context appears once analysis begins."}
            </p>
          </div>
        )}
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
