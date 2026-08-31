"use client";

import Link from "next/link";
import { ArrowLeft, Bot, Menu, X } from "lucide-react";

interface DocsHeaderProps {
  mobileOpen: boolean;
  onToggleMobile: () => void;
}

export function DocsHeader({ mobileOpen, onToggleMobile }: DocsHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobile}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={mobileOpen ? "Close documentation navigation" : "Open documentation navigation"}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>

          <Link href="/docs" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-950 dark:text-white">
            <span className="flex size-7 items-center justify-center rounded-lg bg-slate-950 font-mono text-xs font-bold text-white dark:bg-white dark:text-slate-950">
              V
            </span>
            <span className="text-base font-bold">Verdict</span>
            <span className="text-slate-400 dark:text-slate-600 font-normal">/</span>
            <span className="rounded-md border border-slate-200/80 bg-slate-100/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Docs
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-4 sm:gap-6" aria-label="Quick links">
          <Link
            href="/agents"
            className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-colors"
          >
            <Bot className="size-3.5" />
            <span>Agent API</span>
          </Link>

          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 transition-colors"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Workspace</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
