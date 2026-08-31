import type { Metadata } from "next";
import Link from "next/link";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsCodeBlock } from "@/components/docs/DocsCodeBlock";

export const metadata: Metadata = {
  title: "Error Handling",
  description:
    "Public error response structure, sanitized error codes, and client recovery strategies.",
};

export default function ErrorsPage() {
  const errors = [
    {
      status: "400",
      code: "INVALID_REQUEST",
      message: "Invalid JSON body or unexpected request shape.",
      recovery: "Ensure the request body is valid JSON with exactly one 'url' field.",
    },
    {
      status: "400",
      code: "INVALID_URL",
      message: "The URL is not auditable or violates URL security policies.",
      recovery: "Provide a public HTTP or HTTPS startup URL. Private IPs, localhost, and non-web schemes are rejected.",
    },
    {
      status: "402",
      code: "PAYMENT-REQUIRED",
      message: "Payment challenge issued via the x402 protocol (PAYMENT-REQUIRED header).",
      recovery: "Sign and attach the PAYMENT-SIGNATURE header authorization for $0.50 USDC on Base.",
    },
    {
      status: "422",
      code: "AUDIT_UNAVAILABLE",
      message: "The startup could not be audited (unreachable or blocked extraction).",
      recovery: "Verify the target website is publicly online and not blocking headless browser verification.",
    },
    {
      status: "503",
      code: "AUDIT_TEMPORARILY_UNAVAILABLE",
      message: "The audit service is temporarily unavailable due to transient capacity limits.",
      recovery: "Retry the request with exponential backoff after a short delay.",
    },
    {
      status: "500",
      code: "AUDIT_FAILED",
      message: "The audit could not be completed due to an unrecoverable internal error.",
      recovery: "Log the report error. Unsettled entitlements are released safely.",
    },
    {
      status: "500",
      code: "X402_CONFIGURATION_ERROR",
      message: "The server encountered a configuration error with its x402 payment rail.",
      recovery: "Ensure server-side payment configuration and credentials are set correctly.",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Agent API
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Error Handling & Codes
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Verdict uses deterministic, sanitized error structures. Internal model internals,
          provider stack traces, and private prompts are never exposed to API consumers.
        </p>
      </div>

      {/* Error Schema */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Standard Error Response Format
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          All errors return a standard JSON object containing a machine-readable <code>code</code>{" "}
          and human-readable <code>message</code>:
        </p>

        <DocsCodeBlock language="json" filename="Error Response">
{`{
  "error": {
    "code": "INVALID_URL",
    "message": "The URL is not auditable"
  }
}`}
        </DocsCodeBlock>
      </section>

      {/* Error Catalog */}
      <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Sanitized Error Catalog
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 font-semibold w-20">Status</th>
                <th className="px-5 py-3.5 font-semibold w-48">Code</th>
                <th className="px-5 py-3.5 font-semibold">Message & Recovery Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {errors.map((err) => (
                <tr key={err.code}>
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-950 dark:text-white">
                    {err.status}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {err.code}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-200">{err.message}</p>
                    <p className="text-slate-500 dark:text-slate-400">{err.recovery}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DocsCallout type="security" title="Sanitization Guarantee">
        No stack traces, internal database IDs, or model provider error strings are ever passed
        through in the public API response.
      </DocsCallout>

      <DocsPagination
        prev={{
          title: "API reference",
          href: "/docs/api-reference",
          description: "Endpoint parameter definitions.",
        }}
        next={{
          title: "Security & privacy",
          href: "/docs/security",
          description: "Public data boundaries and non-custodial architecture.",
        }}
      />
    </div>
  );
}
