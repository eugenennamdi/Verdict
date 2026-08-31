import type { Metadata } from "next";
import { Download } from "lucide-react";
import { DocsPagination } from "@/components/docs/DocsPagination";

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

      {/* Download Action */}
      <section className="space-y-4">
        <div>
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
