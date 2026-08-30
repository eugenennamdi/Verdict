"use client";

import { useEffect, useState } from "react";
import {
  X,
  Check,
  Circle,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import type { ActivityEvent } from "@/lib/audit/events";
import { EVIDENCE_CATEGORIES } from "@/lib/audit/evidence";
import type { AuditSummary, WorkspacePhase } from "./types";
import {
  discoveredCandidateCount,
  evidenceSourcesFromEvents,
  latestCoverageFromEvents,
  presentActivityEvents,
  stopReasonLabel,
  successfulEvidenceSources,
} from "./investigationPresentation";

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

  const hasScoring = isComplete || seen.has("scoring.started");
  const hasReport = isComplete || seen.has("report.persisted");

  const company = auditResult?.identity?.company_name || auditResult?.company_name || targetDomain || "Startup";
  const identity = auditResult?.identity;
  const evidence = auditResult?.evidence;
  const activityRows = presentActivityEvents(events);
  const persistedSources = successfulEvidenceSources(evidence);
  const sources = persistedSources.length > 0
    ? persistedSources
    : evidenceSourcesFromEvents(events);
  const candidatesDiscovered =
    auditResult?.investigation?.candidatesDiscovered ?? discoveredCandidateCount(events);
  const coverage = auditResult?.finalCoverage ?? latestCoverageFromEvents(events);
  const stopLabel = stopReasonLabel(auditResult?.stopReason ?? auditResult?.investigation?.stopReason);

  const panelContent = (
    <aside
      className="flex h-full w-[340px] xl:w-[360px] max-w-[90vw] flex-col border-l border-slate-200/80 bg-slate-50/75 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-md transition-[width,transform] duration-200 ease-out font-sans select-text"
      aria-label="Audit context"
    >
      {/* Panel Header */}
      <div className="flex h-13 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold tracking-tight text-slate-950 dark:text-white">
            Audit Context
          </h2>

          {isInvestigating && (
            <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {elapsed}
            </span>
          )}

          {failed && (
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

      <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-slate-200/70 dark:divide-slate-800/70 space-y-4 text-slate-900 dark:text-slate-100">
        {/* 1. Investigation Activity */}
        {activityRows.length > 0 && (
          <section aria-labelledby="section-activity" className="pt-1">
            <div className="flex items-center justify-between pb-2">
              <h3
                id="section-activity"
                className="text-[12px] font-semibold text-slate-800 dark:text-slate-200"
              >
                Activity
              </h3>
              {candidatesDiscovered > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                  {candidatesDiscovered} discovered
                </span>
              )}
            </div>
            <ol className="space-y-2 pt-0.5" aria-live="polite">
              {activityRows.map((row, index) => {
                const isCurrentActive =
                  row.tone === "active" && isInvestigating && index === activityRows.length - 1;
                return (
                  <li key={`${row.type}-${index}`} className="flex items-start gap-2 text-[12px]">
                    <span className="mt-0.5 shrink-0">
                      {row.tone === "warning" || row.tone === "failed" ? (
                        <AlertCircle
                          className={`size-3.5 ${
                            row.tone === "failed" ? "text-rose-500" : "text-amber-500"
                          }`}
                        />
                      ) : isCurrentActive ? (
                        <span className="flex size-3.5 items-center justify-center">
                          <span className="size-2 rounded-full bg-orange-500 ring-4 ring-orange-500/15" />
                        </span>
                      ) : (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Check className="size-2 stroke-[3]" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={`block font-medium ${
                          isCurrentActive
                            ? "font-semibold text-slate-950 dark:text-white"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {row.label}
                      </span>
                      {row.detail && (
                        <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                          {row.detail}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {stopLabel && isComplete && (
              <p className="mt-2.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                {stopLabel}
              </p>
            )}
          </section>
        )}

        {/* 2. Sources */}
        {(sources.length > 0 || candidatesDiscovered > 0) && (
          <section aria-labelledby="section-sources" className="pt-3">
            <div className="flex items-center justify-between pb-1.5">
              <h3
                id="section-sources"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800 dark:text-slate-200"
              >
                <Layers className="size-3.5 text-slate-400 dark:text-slate-500" />
                <span>Sources</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                {sources.length} inspected
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 py-1.5 transition-colors hover:text-slate-950 dark:hover:text-white"
                  title={source.url}
                  aria-label={`Open source ${source.path} in a new tab`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12px] font-medium text-slate-800 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white">
                      {source.path === "/" ? targetDomain ?? source.url : source.path}
                    </span>
                    <span className="block text-[11px] capitalize text-slate-500 dark:text-slate-400">
                      {source.role === "homepage" ? "Homepage" : source.category ?? "Supporting"}
                    </span>
                  </div>
                  <ExternalLink className="size-3 shrink-0 text-slate-400 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                </a>
              ))}
              {sources.length === 0 && (
                <p className="py-2 text-[11.5px] text-slate-400">No additional evidence pages were acquired.</p>
              )}
            </div>
          </section>
        )}

        {/* 3. Evidence Coverage */}
        {coverage && (
          <section aria-labelledby="section-coverage" className="pt-3">
            <div className="flex items-center justify-between pb-2">
              <h3
                id="section-coverage"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800 dark:text-slate-200"
              >
                <Sparkles className="size-3.5 text-slate-400 dark:text-slate-500" />
                <span>Evidence coverage</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                Depth · not a score
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5">
              {EVIDENCE_CATEGORIES.map((category) => {
                const level = coverage[category];
                return (
                  <div key={category} className="flex items-center justify-between gap-1.5 text-[12px]">
                    <span className="truncate capitalize text-slate-600 dark:text-slate-400">{category}</span>
                    <span
                      className={`font-mono text-[11.5px] capitalize ${
                        level === "high"
                          ? "font-semibold text-emerald-600 dark:text-emerald-400"
                          : level === "medium"
                            ? "font-medium text-slate-700 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {level}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. Extracted Startup Context */}
        <section aria-labelledby="section-context" className="pt-3">
          <div className="flex items-center justify-between pb-2">
            <h3
              id="section-context"
              className="text-[12px] font-semibold text-slate-800 dark:text-slate-200"
            >
              Extracted context
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
                <span className="max-w-[120px] truncate">{targetDomain || targetUrl}</span>
                <ExternalLink className="size-2.5 shrink-0" />
              </a>
            )}
          </div>

          {identity ? (
            <dl className="space-y-2 text-[12px]">
              <div>
                <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Startup</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{company}</dd>
              </div>

              {identity.inferred_description && (
                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Value Proposition</dt>
                  <dd className="leading-relaxed text-slate-800 dark:text-slate-200">
                    {identity.inferred_description}
                  </dd>
                </div>
              )}

              {identity.target_audience && (
                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Target ICP</dt>
                  <dd className="leading-relaxed text-slate-800 dark:text-slate-200">{identity.target_audience}</dd>
                </div>
              )}

              {identity.primary_cta && (
                <div>
                  <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Primary CTA</dt>
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
          ) : (
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500">Context appears once investigation begins.</p>
          )}
        </section>

        {/* 5. Seven-Pillar Evaluation Framework */}
        <section aria-labelledby="section-evaluation" className="pt-3">
          <div className="flex items-center justify-between pb-2">
            <h3
              id="section-evaluation"
              className="text-[12px] font-semibold text-slate-800 dark:text-slate-200"
            >
              Evaluation
            </h3>
            {isInvestigating && hasScoring && !hasReport ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">
                <span className="size-1.5 rounded-full bg-orange-500 ring-2 ring-orange-500/20" />
                Evaluating
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                7 pillars
              </span>
            )}
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
                    <p className="leading-snug text-[11.5px] text-slate-500 dark:text-slate-400">
                      {pillar.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
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
