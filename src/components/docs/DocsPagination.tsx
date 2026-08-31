import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DocsNavItem } from "@/lib/docs/navigation";

interface DocsPaginationProps {
  prev?: DocsNavItem;
  next?: DocsNavItem;
}

export function DocsPagination({ prev, next }: DocsPaginationProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Documentation page pagination"
      className="mt-14 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-2 dark:border-slate-800/80"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col items-start justify-between rounded-2xl border border-slate-200/80 bg-white p-4 transition-all hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700 shadow-xs"
        >
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Previous</span>
          </div>
          <span className="mt-2 text-sm font-bold text-slate-950 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div aria-hidden="true" className="hidden sm:block" />
      )}

      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-right transition-all hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700 shadow-xs sm:col-start-2"
        >
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Next</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </div>
          <span className="mt-2 text-sm font-bold text-slate-950 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
