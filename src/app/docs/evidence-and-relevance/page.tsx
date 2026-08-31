import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Evidence & Relevance",
  description:
    "Why page acquisition is separated from relevance admission in Verdict's investigation engine.",
};

export default function EvidenceAndRelevancePage() {
  const rejectionReasons = [
    {
      code: "unrelated_business",
      title: "Unrelated Business or Entity",
      desc: "Content belonging to a subsidiary, sister product, partner, or sponsor that does not reflect the core startup.",
    },
    {
      code: "user_generated_content",
      title: "User-Generated Content",
      desc: "Public forums, community comment threads, unmoderated boards, or customer support tickets with high noise.",
    },
    {
      code: "stale_content",
      title: "Stale or Deprecated Content",
      desc: "Archived changelogs, legacy subdomains, or out-of-date product documentation that contradicts the current product surface.",
    },
    {
      code: "relevance_unverified",
      title: "Relevance Unverified (Fail-Closed)",
      desc: "Ambiguous or truncated pages where entity relevance cannot be conclusively established.",
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
          Evidence & Relevance Admission
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          A fundamental tenet of Verdict&apos;s architecture is that <strong>successful page acquisition
          does not equal accepted evidence</strong>.
        </p>
      </div>

      {/* Section: The Trust Boundary */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          The Relevance Admission Gate
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Web crawlers frequently ingest irrelevant pages: legal boilerplate, cookie policies,
          unrelated third-party widgets, or legacy subpaths. If passed directly to an LLM evaluator,
          these noisy pages distort the growth score and produce hallucinations.
        </p>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          To prevent this, Verdict enforces an explicit <strong>Relevance Admission Boundary</strong>{" "}
          between page acquisition and grading:
        </p>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">
              Admission Rule
            </span>
            <span className="text-xs font-medium text-slate-500">Fail-Closed Policy</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
            Supporting content must be proven to materially describe the audited entity before
            it is admitted into the final evidence pool. When relevance cannot be verified, the
            page is discarded with a fail-closed status.
          </p>
        </div>
      </section>

      {/* Section: Rejection Reasons */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Relevance Rejection Categories
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Pages that fail the relevance gate are categorized using deterministic reason codes:
        </p>

        <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
          {rejectionReasons.map((reason) => (
            <div
              key={reason.code}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {reason.code}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                {reason.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {reason.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <DocsCallout type="note" title="Public evidence metrics">
        In the public API response and report summary, Verdict outputs both <code>pagesInspected</code>{" "}
        and <code>pagesAccepted</code> so consumers can verify how much acquired content passed the
        relevance admission boundary.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Investigation model",
          href: "/docs/investigation-model",
          description: "Autonomous investigation pipeline.",
        }}
        next={{
          title: "Evaluation framework",
          href: "/docs/evaluation-framework",
          description: "The seven core growth dimensions.",
        }}
      />
    </div>
  );
}
