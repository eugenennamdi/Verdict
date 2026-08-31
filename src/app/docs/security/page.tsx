import type { Metadata } from "next";
import { DocsPagination } from "@/components/docs/DocsPagination";

export const metadata: Metadata = {
  title: "Security & Privacy",
  description:
    "Security architecture, data privacy boundaries, and non-custodial payment policies of Verdict.",
};

export default function SecurityPrivacyPage() {
  const principles = [
    {
      title: "Public Surface Inspection Only",
      desc: "Verdict only accesses and analyzes publicly reachable web pages and documentation. We never request private intranet credentials, internal API keys, or private code repositories.",
    },
    {
      title: "Non-Custodial Payment Architecture",
      desc: "Verdict never stores user private keys or holds custody of cryptocurrency funds. Human audits require explicit user wallet confirmation in the browser. Agent requests use signed EIP-712 authorizations verified directly on Base.",
    },
    {
      title: "Server-Side Secret Isolation",
      desc: "All internal LLM API keys, database credentials, and payment facilitator secrets are maintained exclusively in secure server-side environments. No secrets are ever sent to the client.",
    },
    {
      title: "SSRF & Domain Verification",
      desc: "All submitted URLs are strictly validated against Server-Side Request Forgery (SSRF) filters. Requests to private subnets (10.0.0.0/8, 192.168.0.0/16, 127.0.0.1) and non-HTTP protocols are rejected instantly.",
    },
    {
      title: "Sanitized Error Boundaries",
      desc: "Internal model failures, database errors, and raw vendor exceptions are stripped and sanitized before reaching public responses, preventing information disclosure.",
    },
    {
      title: "Relevance Admission Filtering",
      desc: "Acquired web pages must pass explicit entity relevance verification before contributing to audit scoring, preventing injection of malicious or unrelated third-party content.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Trust
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Security & Privacy
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict is built with a defense-in-depth approach to data privacy, non-custodial
          payments, and responsible AI analysis.
        </p>
      </div>

      {/* Security Principles Grid */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Core Security Guarantees
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          {principles.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2"
            >
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section: Data Retention */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Audit Data Retention
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          When an audit finishes, Verdict persists the synthesized report summary and scoring
          findings in Supabase to enable permanent sharing and grounded follow-up conversation.
          Raw intermediate scraped HTML and ephemeral planner reasoning are discarded after grading.
        </p>
      </section>

      <DocsPagination
        prev={{
          title: "Errors",
          href: "/docs/errors",
          description: "Sanitized error structures.",
        }}
        next={{
          title: "Payments",
          href: "/docs/payments",
          description: "Human quotas, Base USDC entitlement, and agent x402.",
        }}
      />
    </div>
  );
}
