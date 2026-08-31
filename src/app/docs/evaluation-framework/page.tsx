import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Evaluation Framework",
  description:
    "Deep dive into Verdict's seven foundational growth dimensions and their diagnostic evaluation criteria.",
};

export default function EvaluationFrameworkPage() {
  const pillars = [
    {
      number: "01",
      name: "Positioning & ICP",
      weight: "20%",
      summary: "Ideal Customer Profile definition and market wedge clarity.",
      signals: [
        "Is it immediately obvious who the product is built for?",
        "Are explicit personas, industries, or company sizes named?",
        "Does the product have a focused initial wedge or does it attempt to serve 'everyone'?",
      ],
    },
    {
      number: "02",
      name: "Messaging & Copy",
      weight: "15%",
      summary: "Value proposition clarity and freedom from empty buzzwords.",
      signals: [
        "Does the headline explain what the software actually does in plain terms?",
        "Is the copy free of empty generic buzzwords ('seamlessly empower workflows')?",
        "Can a technical or business buyer grasp the primary benefit in under 5 seconds?",
      ],
    },
    {
      number: "03",
      name: "Website & UX",
      weight: "15%",
      summary: "Time-to-value, visual hierarchy, and friction in the user journey.",
      signals: [
        "Is the onboarding path immediate (e.g. self-serve signup vs forced demo scheduling)?",
        "Are screenshots, interactive demos, or live UI previews clearly visible?",
        "Is visual hierarchy clean, legible, and responsive across mobile viewports?",
      ],
    },
    {
      number: "04",
      name: "Conversion Triggers",
      weight: "15%",
      summary: "Psychological hooks, risk reversal, ROI promises, and action triggers.",
      signals: [
        "Is the primary call-to-action clear, prominent, and repeatable throughout the page?",
        "Is there explicit risk reversal (free tier, money-back guarantee, open-source tier)?",
        "Does the product articulate clear financial or time-saving ROI?",
      ],
    },
    {
      number: "05",
      name: "Trust & Social Proof",
      weight: "10%",
      summary: "Credibility markers, customer logos, case studies, and metrics.",
      signals: [
        "Are there recognizable customer logos and verifiable customer quotes?",
        "Are case studies backed by quantitative outcome metrics?",
        "Are security badges, compliance certifications (SOC2, ISO), or uptime stats visible?",
      ],
    },
    {
      number: "06",
      name: "Defensibility",
      weight: "10%",
      summary: "Proprietary technology, moat, network effects, and switching costs.",
      signals: [
        "Does the product possess proprietary algorithms, integrations, or data assets?",
        "Are there multi-player collaboration loops or network effects?",
        "Is this a defensible platform or an easily-cloned thin wrapper?",
      ],
    },
    {
      number: "07",
      name: "Growth Foundation",
      weight: "15%",
      summary: "Scalable acquisition loops, referral channels, and organic distribution.",
      signals: [
        "Are there organic distribution loops (product-led sharing, public links, badges)?",
        "Is developer documentation, API access, or community support readily available?",
        "Can the company acquire customers sustainably without linear ad spend?",
      ],
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          How Verdict Works
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          The 7-Dimension Framework
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict evaluates every startup against a structured, 7-dimension diagnostic framework.
          Each dimension represents a pillar of commercial growth and conversion health.
        </p>
      </div>

      {/* Pillars Breakdown */}
      <section className="space-y-6">
        {pillars.map((pillar) => (
          <article
            key={pillar.number}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                  {pillar.number}
                </span>
                <h2 className="text-base font-bold text-slate-950 dark:text-white">
                  {pillar.name}
                </h2>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Weight: {pillar.weight}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {pillar.summary}
            </p>

            <div className="space-y-1.5 pt-1">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Key Diagnostic Signals Evaluated:
              </p>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {pillar.signals.map((sig, i) => (
                  <li key={i}>• {sig}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <DocsPagination
        prev={{
          title: "Evidence & relevance",
          href: "/docs/evidence-and-relevance",
          description: "Relevance admission boundary.",
        }}
        next={{
          title: "Recommendations",
          href: "/docs/recommendations",
          description: "Prioritized growth roadmap.",
        }}
      />
    </div>
  );
}
