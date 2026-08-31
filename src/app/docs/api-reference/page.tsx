import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";
import { AGENT_AUDIT_PATH, AGENT_AUDIT_URL } from "@/lib/agentApi/content";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Complete technical reference for Verdict's POST /api/v2/audit endpoint, request schemas, and response shapes.",
};

export default function ApiReferencePage() {
  const responseFields = [
    { name: "reportId", type: "string", desc: "Permanent unique identifier for the persisted audit memo." },
    { name: "overallScore", type: "number", desc: "Growth Readiness Score from 0 to 100." },
    { name: "company_name", type: "string", desc: "Normalized company/product name identified from root evidence." },
    { name: "identity", type: "object", desc: "Normalized identity profile (company_name, inferred_description, target_audience, primary_cta)." },
    { name: "the_verdict", type: "object", desc: "Executive synthesis (status, primary_constraint, highest_opportunity, estimated_impact)." },
    { name: "score_interpretation", type: "string", desc: "Qualitative narrative explaining the overall Growth Readiness Score." },
    { name: "priority_matrix", type: "array", desc: "Ranked action items with task, why, impact, and effort ratings." },
    { name: "pillars", type: "object", desc: "Qualitative evaluations per growth dimension (confidence, reason, strengths, weaknesses) without numeric score." },
    { name: "sources", type: "array", desc: "Admitted evidence sources supporting the audit (url, path, role, category, keyFindings)." },
    { name: "pagesInspected", type: "number", desc: "Total number of pages successfully acquired/fetched during the investigation pass." },
    { name: "pagesAccepted", type: "number", desc: "Total number of acquired pages admitted through the relevance boundary." },
    { name: "stopReason", type: "string", desc: "Investigation completion reason (e.g. 'sufficient', 'page_budget', 'no_candidates')." },
    { name: "evidenceCoverage", type: "object", desc: "Aggregate evidence coverage metrics (pagesTotal, pagesAcquired, pagesAccepted, charsTotal, categories)." },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Agent API
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          API Reference
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Detailed technical reference for the canonical <code>POST {AGENT_AUDIT_PATH}</code> endpoint.
        </p>
      </div>

      {/* Endpoint Badge */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs font-mono text-sm">
          <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-slate-950">
            POST
          </span>
          <span className="font-bold text-slate-950 dark:text-white">{AGENT_AUDIT_URL}</span>
        </div>
      </section>

      {/* Request Schema */}
      <section className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Request Body
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The request body must be a JSON object containing exactly one required field:
        </p>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Field</th>
                <th className="px-5 py-3.5 font-semibold w-24">Type</th>
                <th className="px-5 py-3.5 font-semibold w-24">Required</th>
                <th className="px-5 py-3.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-slate-950 dark:text-white">url</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">string</td>
                <td className="px-5 py-3.5 font-semibold text-orange-600 dark:text-orange-400">Yes</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                  The valid public HTTP/HTTPS URL of the company or software startup to investigate.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <DocsCodeBlock language="json" filename="Request Example">
{`{
  "url": "https://linear.app"
}`}
        </DocsCodeBlock>
      </section>

      {/* Response Schema */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Response Body (200 OK)
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          The endpoint returns a structured JSON payload summarizing the audit verdict and evidence coverage:
        </p>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold">Property</th>
                <th className="px-5 py-3.5 font-semibold w-24">Type</th>
                <th className="px-5 py-3.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {responseFields.map((field) => (
                <tr key={field.name}>
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-950 dark:text-white">
                    {field.name}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{field.type}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{field.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Status Codes Table */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          HTTP Status Codes
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold w-24">Status</th>
                <th className="px-5 py-3.5 font-semibold w-48">Code</th>
                <th className="px-5 py-3.5 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">200</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">OK</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Audit successfully completed and persisted.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">400</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">INVALID_REQUEST</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Invalid JSON request body or unexpected request shape.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">400</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">INVALID_URL</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Malformed URL, non-HTTP scheme, or forbidden IP address.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">402</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">PAYMENT-REQUIRED</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">x402 payment challenge issued with Base USDC payment requirements.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">422</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">AUDIT_UNAVAILABLE</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Target site is unreachable, blocked, or not auditable.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">503</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">AUDIT_TEMPORARILY_UNAVAILABLE</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Transient model or upstream network capacity limitation.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">500</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">AUDIT_FAILED</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Unhandled internal error during audit execution.</td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">500</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">X402_CONFIGURATION_ERROR</td>
                <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">Server-side x402 payment rail misconfiguration.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <DocsPagination
        prev={{
          title: "x402 payment flow",
          href: "/docs/x402-flow",
          description: "Payment challenge protocol.",
        }}
        next={{
          title: "Errors",
          href: "/docs/errors",
          description: "Error structures and client recovery patterns.",
        }}
      />
    </div>
  );
}
