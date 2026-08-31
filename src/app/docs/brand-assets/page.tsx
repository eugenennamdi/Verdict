import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { DocsPagination } from "@/components/docs/DocsPagination";
import { DocsCallout } from "@/components/docs/DocsCallout";

export const metadata: Metadata = {
  title: "Brand Assets",
  description:
    "Official logos, marks, and design guidelines for Verdict.",
};

export default function BrandAssetsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <p className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Reference
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Brand Assets
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 pt-1">
          Official logos, marks, and design assets for Verdict. Use these assets when referencing
          Verdict in articles, research, partner integrations, or developer tools.
        </p>
      </div>

      {/* Asset Preview Cards */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Vector Assets & Marks
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          {/* Mark Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-4">
            <div className="flex h-24 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-900">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white font-mono text-base font-bold text-slate-950">
                V
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Verdict Logo Mark
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Monochrome square mark for avatars, favicon, and app icons.
              </p>
            </div>
          </div>

          {/* Wordmark Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800/80 dark:bg-slate-900/40 shadow-xs space-y-4">
            <div className="flex h-24 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5 font-bold tracking-tight text-lg">
                <span className="flex size-6 items-center justify-center rounded-md bg-white font-mono text-xs font-bold text-slate-950">
                  V
                </span>
                <span>Verdict</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Full Wordmark
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Full horizontal lockup for navigation bars, headers, and media.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <a
            href="/verdict-brand-assets.zip"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 transition-colors shadow-xs"
          >
            <Download className="size-4" />
            <span>Download All Brand Assets (.ZIP)</span>
          </a>
        </div>
      </section>

      <DocsPagination
        prev={{
          title: "FAQ",
          href: "/docs/faq",
          description: "Frequently asked questions.",
        }}
      />
    </div>
  );
}
