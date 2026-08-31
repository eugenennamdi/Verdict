import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Running an Audit",
  description:
    "Input requirements, investigation lifecycle, timing, and error handling for Verdict audits.",
};

export default function RunningAnAuditPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Using Verdict
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Running an Audit
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Everything you need to know about preparing target URLs, understanding audit execution,
          handling failure states, and managing quota entitlements.
        </p>
      </div>

      {/* Section: Acceptable Inputs */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          What URLs can Verdict audit?
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Verdict evaluates public commercial web surfaces. For the most accurate and insightful
          growth analysis, submit the primary root domain of a startup or software company.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-xs">
            <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-300 mb-2">
              Supported & Recommended
            </h3>
            <ul className="space-y-2 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-400/90">
              <li>• B2B SaaS and enterprise software websites</li>
              <li>• Developer tools, APIs, and infrastructure platforms</li>
              <li>• Early-stage and growth-stage startup landing pages</li>
              <li>• B2C digital products, apps, and consumer software</li>
              <li>• Web3 protocols, decentralized apps, and tooling sites</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-2">
              Filtered or Unsupported
            </h3>
            <ul className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <li>• Personal blogs, linktrees, and developer portfolios</li>
              <li>• Raw GitHub/GitLab repositories and code mirrors</li>
              <li>• Empty holding pages, parked domains, or &quot;coming soon&quot; stubs</li>
              <li>• Password-protected portals or private intranet apps</li>
              <li>• Aggregator link directories and search engines</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section: Investigation Behavior & Timing */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Investigation Timing & Execution
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Most audits complete in around <strong>one to a few minutes</strong> end-to-end. The exact duration
          depends on site complexity, JavaScript rendering overhead, candidate discovery volume,
          and model tier response times.
        </p>

        <DocsCallout type="note" title="Bounded research limits">
          Verdict enforces strict bounded research limits: it inspects relevant supporting pages
          (pricing, features, documentation) to build high evidence coverage without running an
          exhaustive, unbounded web crawl.
        </DocsCallout>
      </section>

      {/* Section: Failure Handling & Quota Protection */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Failures & Quota Safety
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          If a target website is unreachable, blocks extraction, or returns completely unusable
          content, the audit will fail gracefully with a descriptive error message.
        </p>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-950 dark:text-white">
            How failures affect your usage:
          </h3>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            <li>
              <strong>Free Quota:</strong> A failed audit does <em>not</em> count against your 3 free
              successful audits per 24 hours. Your remaining audit count remains intact.
            </li>
            <li>
              <strong>Paid Entitlement:</strong> If an audit fails after reserving a paid entitlement,
              Verdict immediately releases the reserved entitlement so you can retry another URL
              without losing your purchase.
            </li>
          </ul>
        </div>
      </section>

      {/* Section: Restoring Past Audits */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Restoring & Sharing Audits
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Every completed audit produces a persistent report accessible at a permanent URL
          (e.g., <code>/report/[id]</code>). You can bookmark the URL, copy the link from the
          floating action dock, or share it with co-founders and team members.
        </p>
      </section>

      <DocsPagination
        prev={{
          title: "Quickstart",
          href: "/docs/quickstart",
          description: "Step-by-step audit walkthrough.",
        }}
        next={{
          title: "Reading your result",
          href: "/docs/reading-your-result",
          description: "Navigating the score, bottleneck, and full report.",
        }}
      />
    </div>
  );
}
