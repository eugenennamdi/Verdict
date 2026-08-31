"use client";

import Link from "next/link";
import { ArrowLeft, Menu, X } from "lucide-react";

interface DocsHeaderProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function DocsHeader({ mobileOpen, onToggleMobile }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobile}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={mobileOpen ? "Close documentation navigation" : "Open documentation navigation"}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>

          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-slate-600 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-colors"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to workspace</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
