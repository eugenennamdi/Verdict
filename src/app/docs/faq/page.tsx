import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Verdict's autonomous growth audits, scoring, quotas, and Agent API.",
};

export default function FaqPage() {
  const faqs = [
    {
      q: "What makes Verdict different from asking ChatGPT to review my landing page?",
      a: "Generic chatbots evaluate a single pasted prompt or screenshot with strong positivity bias. Verdict runs an autonomous multi-stage investigation: discovering supporting pages, filtering out noise via relevance admission, evaluating evidence across 7 distinct growth dimensions, and computing a deterministic score with prioritized recommendations.",
    },
    {
      q: "Does Verdict crawl my entire website?",
      a: "No. Verdict executes a bounded, selective discovery pass focusing on high-signal commercial pages (pricing, product features, documentation, case studies). It does not crawl thousands of irrelevant blog articles or legal notices.",
    },
    {
      q: "How is the Growth Readiness Score calculated?",
      a: "The overall score is calculated using fixed weights applied to structured dimension evaluations: Positioning (20%), Messaging (15%), Website & UX (15%), Conversion Triggers (15%), Trust (10%), Defensibility (10%), and Growth Foundation (15%). The aggregation formula is deterministic.",
    },
    {
      q: "What happens if a website cannot be audited?",
      a: "If the target domain is unreachable, blocks extraction, or returns non-auditable content, the audit fails gracefully. Failed audits do not count against your free daily quota, and any reserved paid entitlements are automatically released.",
    },
    {
      q: "How many free audits do I get?",
      a: "Every human user receives up to 3 successful free audits per rolling 24-hour window. Follow-up conversations on completed audits are unlimited.",
    },
    {
      q: "How much does a paid audit cost?",
      a: "Additional audits cost $0.50 USDC on Base Mainnet. There are no recurring monthly subscriptions or minimum spend requirements.",
    },
    {
      q: "Do I need to deposit funds into a Verdict balance?",
      a: "No. Verdict is completely non-custodial. For human audits, you authorize the $0.50 USDC transfer directly from your connected browser wallet. For agents, x402 handles point-in-time micro-payments.",
    },
    {
      q: "What is the Agent API?",
      a: "The Agent API (POST /api/v2/audit) is a machine-to-machine endpoint that allows autonomous software agents to purchase and run growth audits programmatically via the x402 V2 payment protocol on Base.",
    },
    {
      q: "Can I share my audit report with my team?",
      a: "Yes. Every completed audit produces a permanent report at /report/[id]. You can copy and share this link directly with founders, investors, or advisors.",
    },
    {
      q: "Does Verdict use my audit data to train AI models?",
      a: "No. Verdict does not use private audit conversations or customer reports to train public foundational AI models.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Reference
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Quick, definitive answers to common questions about using Verdict, interpreting scores,
          and integrating the Agent API.
        </p>
      </div>

      {/* FAQ Accordion / Cards */}
      <section className="space-y-4">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white p-5.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-2"
          >
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              {faq.q}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {faq.a}
            </p>
          </div>
        ))}
      </section>

      <DocsPagination
        prev={{
          title: "Limits & usage",
          href: "/docs/limits",
          description: "Quotas and entitlements.",
        }}
        next={{
          title: "Brand assets",
          href: "/docs/brand-assets",
          description: "Official logos, wordmarks, and guidelines.",
        }}
      />
    </div>
  );
}
