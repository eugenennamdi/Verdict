import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Get started with Verdict by auditing a startup URL.",
};

export default function QuickstartPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Getting Started
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Quickstart Guide
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Learn how to run your first Growth Readiness audit using the conversational
          workspace, interpret the executive brief, and ask follow-up questions.
        </p>
      </div>

      {/* Step by Step Flow */}
      <section className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              1
            </span>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Open the Verdict Workspace
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 pl-10">
            Navigate to the{" "}
            <Link href="/" className="font-medium text-slate-950 underline dark:text-white">
              Verdict Workspace
            </Link>
            . You will be greeted by the investigation console with a clean URL input bar.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              2
            </span>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Submit a Startup URL
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 pl-10">
            Enter the public domain or URL of the company you wish to audit (for example,{" "}
            <code>https://linear.app</code> or <code>resend.com</code>). Press Enter or click
            the audit arrow to launch the investigation.
          </p>
          <div className="pl-10">
            <DocsCallout type="note" title="Auditable websites">
              Verdict is designed to audit public startup websites, B2B software, SaaS, and developer
              tools. Personal blogs, empty domains, and raw code repositories are filtered during
              initial URL admission.
            </DocsCallout>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              3
            </span>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Autonomous Investigation Runs
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 pl-10">
            Verdict executes a bounded multi-page research pass: acquiring primary homepage evidence,
            identifying the company identity, discovering supporting pages, filtering for relevance,
            and grading the evidence across seven growth dimensions. Most audits complete in
            around one to a few minutes, depending on the target site and investigation depth.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              4
            </span>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Review the Growth Readiness Score & Executive Brief
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 pl-10">
            When the audit completes, the inline results card displays:
          </p>
          <ul className="list-disc pl-14 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <li><strong>Growth Readiness Score (0–100):</strong> The composite readiness rating calculated through fixed dimension weights.</li>
            <li><strong>Normalized Company Profile:</strong> Core value proposition, target audience, and primary CTA.</li>
            <li><strong>Primary Growth Bottleneck:</strong> The single most critical operational constraint.</li>
            <li><strong>Highest-Leverage Opportunity:</strong> The highest-ROI tactical recommendation.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              5
            </span>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Open the Full Editorial Report
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 pl-10">
            Click <strong>View full report ↗</strong> to open the standalone intelligence memo.
            The report provides in-depth editorial breakdowns across all 7 growth dimensions,
            highlighting <em>What works</em>, <em>Areas to improve</em>, and the prioritized action roadmap.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              6
            </span>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">
              Ask Grounded Follow-up Questions
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 pl-10">
            Return to the conversation workspace at any time to ask follow-up questions about the
            audit findings, such as:
          </p>
          <div className="pl-10">
            <DocsCodeBlock language="markdown">
{`"Why did Verdict identify messaging as our primary bottleneck?"
"What specific copy change would increase conversion on the hero section?"
"How should we prioritize the top three recommendations?"`}
            </DocsCodeBlock>
          </div>
        </div>
      </section>

      {/* Free vs Paid Quotas */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Free Usage & Paid Audits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1">
              Free Quota (Rolling 24 Hours)
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Every user receives up to <strong>3 successful new audits</strong> per rolling
              24-hour window. Follow-up conversations on completed audits remain uncapped and
              do not consume new-audit quota.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1">
              Paid Entitlements ($0.50 USDC)
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              When free quota is exhausted, you can purchase additional audit entitlements
              for <strong>$0.50 USDC</strong> on Base Mainnet via your connected wallet.
              One payment grants exactly one audit entitlement without prepaid lock-in.
            </p>
          </div>
        </div>
      </section>

      <DocsPagination
        prev={{
          title: "Introduction",
          href: "/docs",
          description: "Overview of Verdict.",
        }}
        next={{
          title: "Running an audit",
          href: "/docs/running-an-audit",
          description: "Auditable URL criteria, input validation, and execution.",
        }}
      />
    </div>
  );
}
