import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";

export const metadata: Metadata = {
  title: "Audit Follow-ups",
  description:
    "How to ask grounded conversational questions against the preserved audit context in Verdict.",
};

export default function AuditFollowUpsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Using Verdict
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Audit Follow-ups & Q&A
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Once an audit is complete, the Verdict conversational workspace enables you to ask
          in-depth strategic questions grounded directly in the audit context.
        </p>
      </div>

      {/* Section: Grounded Context */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          How Grounded Follow-up Works
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Unlike generic chat interfaces, Verdict&apos;s follow-up engine operates directly over the
          structured audit payload, evidence pages, and diagnostic scores produced during the audit.
          Responses are strictly grounded in the audited facts rather than hallucinated generalities.
        </p>

        <div className="grid gap-3.5 sm:grid-cols-2 pt-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Available Context
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li>• Normalized company identity & core CTA</li>
              <li>• Seven-pillar evaluation text and findings</li>
              <li>• Identified primary bottleneck & leverage points</li>
              <li>• Prioritized recommendation list with impact/effort</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white mb-1.5">
              Quota Policy
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Follow-up questions on an existing audit <strong>do not consume</strong> new audit
              quota. You can ask multiple detailed questions within your active session without
              triggering paywalls or quota limits.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Example Questions */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          High-Yield Follow-up Questions
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Here are useful question patterns to extract maximum value from your audit:
        </p>

        <DocsCodeBlock language="markdown">
{`# 1. Bottleneck Deep Dive
"Can you explain why positioning was flagged as the primary bottleneck instead of pricing?"

# 2. Tactical Copy Suggestions
"Give me three alternative hero headlines that would clarify our value prop for technical buyers."

# 3. Sequencing Priorities
"If we only have two engineering weeks before our launch, which priority should we implement first?"

# 4. Conversion Friction Analysis
"Where exactly in the onboarding flow does Verdict suspect users are dropping off?"`}
        </DocsCodeBlock>
      </section>

      <DocsCallout type="security" title="Private Model Boundary">
        Verdict never exposes raw prompts, private model reasoning tokens, or internal crawler
        telemetry during follow-up Q&A. All answers are synthesized strictly from the public audit report.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "Growth Readiness Score",
          href: "/docs/growth-readiness-score",
          description: "Weights and interpretation tiers.",
        }}
        next={{
          title: "Investigation model",
          href: "/docs/investigation-model",
          description: "How Verdict investigates websites autonomously.",
        }}
      />
    </div>
  );
}
