"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ImageDown,
  Link2,
  Loader2,
  Share2,
} from "lucide-react";
import { Footer } from "@/components/footer";
import type { CanonicalReportProjection } from "@/lib/audit/canonicalReport";

export type PillarData = {
  score?: number | string;
  reason?: string;
  confidence?: string;
  strengths?: string[];
  weaknesses?: string[];
};

export type PriorityItem = {
  task?: string;
  why?: string;
  impact?: string;
  effort?: string;
};

export type ReportData = {
  id?: string;
  company_name?: string;
  url?: string;
  fdi_overall_score?: number | string;
  executive_summary?: string;
  key_risks?: {
    status?: string;
    primary_constraint?: string;
    highest_opportunity?: string;
    estimated_impact?: string;
  };
  growth_plan_30_day?: Record<string, unknown>;
  top_5_priorities?: PriorityItem[];
  canonicalReportFacts?: CanonicalReportProjection;
};

const CANONICAL_PILLARS = [
  { key: "positioning", title: "Positioning & ICP" },
  { key: "messaging", title: "Messaging & Copy" },
  { key: "website_ux", title: "Website & UX" },
  { key: "conversion", title: "Conversion Triggers" },
  { key: "trust", title: "Trust & Social Proof" },
  { key: "competition", title: "Defensibility (Moat)" },
  { key: "growth_foundation", title: "Growth Foundation" },
];

function resolvePillars(pillarsObj: Record<string, unknown> | undefined) {
  if (!pillarsObj || typeof pillarsObj !== "object") return [];

  const resolved: Array<{
    key: string;
    title: string;
    score: number;
    reason: string;
    strengths: string[];
    weaknesses: string[];
  }> = [];

  const matchedKeys = new Set<string>();

  for (const def of CANONICAL_PILLARS) {
    let matchKey = def.key;
    let raw = pillarsObj[def.key] as PillarData | undefined;

    if (!raw && def.key === "trust") {
      if (pillarsObj["trust_and_credibility"]) {
        matchKey = "trust_and_credibility";
        raw = pillarsObj["trust_and_credibility"] as PillarData;
      }
    } else if (!raw && def.key === "competition") {
      if (pillarsObj["market_and_competition"]) {
        matchKey = "market_and_competition";
        raw = pillarsObj["market_and_competition"] as PillarData;
      }
    }

    if (raw && typeof raw === "object") {
      matchedKeys.add(matchKey);
      resolved.push({
        key: def.key,
        title: def.title,
        score: Number(raw.score || 0),
        reason: typeof raw.reason === "string" ? raw.reason : "",
        strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
        weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : [],
      });
    }
  }

  // Pick up any additional pillars not in the canonical list
  for (const [key, val] of Object.entries(pillarsObj)) {
    if (!matchedKeys.has(key) && val && typeof val === "object") {
      const raw = val as PillarData;
      if (raw.score !== undefined) {
        const title = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/\bUx\b/g, "UX");
        resolved.push({
          key,
          title,
          score: Number(raw.score || 0),
          reason: typeof raw.reason === "string" ? raw.reason : "",
          strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
          weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : [],
        });
      }
    }
  }

  return resolved;
}

export function ReportView({ report }: { report: ReportData }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const canonical = report.canonicalReportFacts;
  const companyName = String(
    canonical?.companyName || report.company_name || "Target Startup"
  );
  const url = report.url ? String(report.url) : "";
  const cleanUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const score = Number(canonical?.overallScore ?? report.fdi_overall_score ?? 0);

  const verdict = report.key_risks || {};
  const executiveSummary =
    canonical?.executiveAssessment || report.executive_summary;
  const primaryConstraint =
    canonical?.primaryBottleneck || verdict.primary_constraint;
  const highestOpportunity =
    canonical?.highestOpportunity || verdict.highest_opportunity;
  const estimatedImpact =
    canonical?.estimatedImpact || verdict.estimated_impact;

  const pillars = resolvePillars(report.growth_plan_30_day);
  const priorities = canonical?.priorities || report.top_5_priorities || [];

  const handleShareX = () => {
    const text = `I just reviewed the autonomous growth audit for ${companyName} on Verdict.\n\nScore: ${score}/100\nRead the full breakdown:`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    if (typeof window !== "undefined") {
      window.open(twitterUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const downloadImage = async () => {
    setIsDownloading(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      const element = document.getElementById("report-content");
      if (!element) return;

      const { toJpeg } = await import("html-to-image");

      const filter = (node: HTMLElement) => {
        if (node?.getAttribute && node.getAttribute("data-export-ignore") === "true") {
          return false;
        }
        return true;
      };

      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 1.0,
        cacheBust: true,
        style: {
          transform: "none",
          margin: "0",
          position: "relative",
        },
        filter: filter,
        backgroundColor: document.documentElement.classList.contains("dark")
          ? "#020617"
          : "#f8fafc",
      });

      const link = document.createElement("a");
      link.download = `${companyName}_Growth_Audit.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Image generation failed", e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-orange-500/20 selection:text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans">
        <main
          id="report-content"
          className="mx-auto max-w-[1040px] px-4 sm:px-8 lg:px-12 py-10 sm:py-20 space-y-16 sm:space-y-24"
        >
          {/* Top Navigation */}
          <nav aria-label="Report navigation" data-export-ignore="true">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              Back to audit
            </Link>
          </nav>

          {/* 1. Header: Strong Company Identity & Overall Score Anchor */}
          <header className="space-y-8 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 sm:gap-12">
              <div className="min-w-0 flex-1 space-y-2">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.1]">
                  {companyName}
                </h1>
                {url && (
                  <div>
                    <a
                      href={url.startsWith("http") ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-[14px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                    >
                      <span>{cleanUrl}</span>
                      <ArrowUpRight className="size-3.5 shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex sm:flex-col items-baseline sm:items-end gap-2.5 shrink-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tabular-nums tracking-tighter text-slate-950 dark:text-white">
                    {score}
                  </span>
                  <span className="text-[16px] sm:text-[18px] font-medium text-slate-400 dark:text-slate-500">
                    /100
                  </span>
                </div>
                <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  Growth Readiness Score
                </span>
              </div>
            </div>
          </header>

          {/* 2. Executive Overview (Whitespace-Driven Continuous Editorial Flow) */}
          <section
            aria-labelledby="overview-heading"
            className="space-y-12 sm:space-y-16"
          >
            <h2 id="overview-heading" className="sr-only">
              Executive Overview
            </h2>

            {/* Executive assessment */}
            {executiveSummary && executiveSummary !== "N/A" && (
              <div className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono">
                  Executive assessment
                </h3>
                <p className="text-[17px] sm:text-[18px] lg:text-[19px] leading-[1.75] font-normal text-slate-900 dark:text-slate-100">
                  {executiveSummary}
                </p>
              </div>
            )}

            {/* Primary bottleneck */}
            {primaryConstraint && (
              <div className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono">
                  Primary bottleneck
                </h3>
                <p className="text-[16px] sm:text-[17px] font-medium leading-[1.7] text-slate-900 dark:text-slate-100">
                  {primaryConstraint}
                </p>
              </div>
            )}

            {/* Highest-leverage opportunity */}
            {highestOpportunity && (
              <div className="space-y-3">
                <h3 className="text-[12px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono">
                  Highest-leverage opportunity
                </h3>
                <p className="text-[16px] sm:text-[17px] font-medium leading-[1.7] text-slate-900 dark:text-white">
                  {highestOpportunity}
                </p>
                {estimatedImpact && (
                  <p className="text-[15px] sm:text-[15.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                    {estimatedImpact}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 3. 7-Pillar Framework Analysis (Sequential Substantive Deep Dive) */}
          {pillars.length > 0 && (
            <section
              aria-labelledby="pillars-heading"
              className="border-t border-slate-200/80 dark:border-slate-800/80 pt-16 sm:pt-20 space-y-12 sm:space-y-16"
            >
              <div className="space-y-2">
                <h2
                  id="pillars-heading"
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
                >
                  Growth Readiness Analysis
                </h2>
                <p className="text-[14.5px] text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  Detailed qualitative and structural assessment across all core dimensions of growth readiness.
                </p>
              </div>

              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {pillars.map((pillar, idx) => (
                  <article
                    key={pillar.key}
                    className="py-12 sm:py-16 first:pt-4 last:pb-0 space-y-7 sm:space-y-9"
                  >
                    {/* Pillar Header */}
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="font-mono text-[14px] sm:text-[15px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-[19px] sm:text-[21px] font-bold text-slate-950 dark:text-white truncate">
                        {pillar.title}
                      </h3>
                    </div>

                    {/* Pillar Narrative Reason */}
                    {pillar.reason && (
                      <p className="text-[15.5px] sm:text-[16.5px] leading-[1.75] text-slate-700 dark:text-slate-300">
                        {pillar.reason}
                      </p>
                    )}

                    {/* Findings: What works & Areas to improve */}
                    {(pillar.strengths.length > 0 || pillar.weaknesses.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 pt-2">
                        {/* What works */}
                        {pillar.strengths.length > 0 && (
                          <div className="space-y-3.5">
                            <h4 className="text-[14px] sm:text-[14.5px] font-semibold text-slate-900 dark:text-white">
                              What works
                            </h4>
                            <ul className="space-y-2.5 text-[14px] sm:text-[14.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                              {pillar.strengths.map((item, sIdx) => (
                                <li key={sIdx} className="flex items-start gap-2.5">
                                  <span className="mt-2 size-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Areas to improve */}
                        {pillar.weaknesses.length > 0 && (
                          <div className="space-y-3.5">
                            <h4 className="text-[14px] sm:text-[14.5px] font-semibold text-slate-900 dark:text-white">
                              Areas to improve
                            </h4>
                            <ul className="space-y-2.5 text-[14px] sm:text-[14.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                              {pillar.weaknesses.map((item, wIdx) => (
                                <li key={wIdx} className="flex items-start gap-2.5">
                                  <span className="mt-2 size-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 4. Recommended Priorities (Action Plan with Elevated Stature) */}
          {priorities.length > 0 && (
            <section
              aria-labelledby="priorities-heading"
              className="border-t border-slate-200/80 dark:border-slate-800/80 pt-16 sm:pt-20 space-y-12 sm:space-y-16"
            >
              <div className="space-y-2">
                <h2
                  id="priorities-heading"
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
                >
                  Recommended Priorities
                </h2>
                <p className="text-[14.5px] text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  Sequenced operational roadmap ordered by expected growth multiplier and deployment friction.
                </p>
              </div>

              <ol className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {priorities.map((item, idx) => (
                  <li
                    key={idx}
                    className="py-10 sm:py-12 first:pt-4 last:pb-0 flex items-start gap-5 sm:gap-7"
                  >
                    <span className="font-mono text-[16px] sm:text-[18px] font-bold text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                      {String(idx + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-6">
                        <h3 className="text-[17px] sm:text-[18px] font-bold text-slate-950 dark:text-white leading-snug">
                          {item.task}
                        </h3>

                        {(item.impact || item.effort) && (
                          <div className="flex items-center gap-3 shrink-0 text-[13px] text-slate-500 dark:text-slate-400 font-mono">
                            {item.impact && (
                              <span>
                                Impact:{" "}
                                <strong className="font-semibold text-slate-900 dark:text-white">
                                  {item.impact}
                                </strong>
                              </span>
                            )}
                            {item.impact && item.effort && (
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                            )}
                            {item.effort && (
                              <span>
                                Effort:{" "}
                                <strong className="font-semibold text-slate-900 dark:text-white">
                                  {item.effort}
                                </strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {item.why && (
                        <p className="text-[15px] sm:text-[15.5px] leading-[1.7] text-slate-600 dark:text-slate-300">
                          {item.why}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 5. Report Methodology & Framework Concluding Footnote */}
          <section
            aria-labelledby="methodology-heading"
            className="border-t border-slate-200/80 dark:border-slate-800/80 pt-12 pb-16 space-y-4"
          >
            <h2
              id="methodology-heading"
              className="text-[12px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono"
            >
              Audit Methodology & Framework
            </h2>
            <p className="text-[13.5px] sm:text-[14px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-3xl">
              Verdict evaluates startup growth readiness across seven foundational dimensions through automated analysis of publicly accessible product surfaces, positioning artifacts, and user acquisition flows.
            </p>
            <div className="pt-2">
              <Link
                href="/docs"
                className="group inline-flex items-center gap-1 text-[13.5px] font-semibold text-slate-900 hover:text-orange-500 dark:text-white dark:hover:text-orange-400 transition-colors"
              >
                <span>Learn more</span>
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </section>
        </main>
      </div>

      {/* Floating Action Dock */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
        data-export-ignore="true"
      >
        <div className="flex items-center p-1 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 shadow-xl shadow-slate-900/10 dark:shadow-black/40">
          <button
            type="button"
            onClick={downloadImage}
            disabled={isDownloading}
            className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 hover:text-orange-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-orange-400 transition-colors active:scale-[0.97] disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-orange-500" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <ImageDown className="size-3.5 text-slate-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
                <span>Save Report</span>
              </>
            )}
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5" />

          <button
            type="button"
            onClick={handleCopyLink}
            className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 hover:text-orange-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-orange-400 transition-colors active:scale-[0.97]"
          >
            {isCopied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="size-3.5 text-slate-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5" />

          <button
            type="button"
            onClick={handleShareX}
            className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 hover:text-orange-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-orange-400 transition-colors active:scale-[0.97]"
          >
            <Share2 className="size-3.5 text-slate-400 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
            <span>Share on X</span>
          </button>
        </div>
      </div>

      <Footer minimal={true} />
    </>
  );
}
