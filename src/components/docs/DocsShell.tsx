"use client";

import { useState } from "react";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsToc, type DocsHeading } from "@/components/docs/DocsToc";

interface DocsShellProps {
  children: React.ReactNode;
  headings?: DocsHeading[];
}

export function DocsShell({ children, headings = [] }: DocsShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-orange-500/20 selection:text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans flex flex-col">
      <DocsHeader
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((prev) => !prev)}
      />

      {/* Mobile Drawer Backdrop and Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 sm:w-80 bg-white p-6 shadow-2xl dark:bg-slate-950 overflow-y-auto border-r border-slate-200 dark:border-slate-800">
            <DocsSidebar onLinkClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 sm:px-8 py-8 sm:py-10 gap-8 lg:gap-10">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-60 xl:w-64 shrink-0">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-3">
            <DocsSidebar />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 max-w-3xl xl:max-w-4xl pb-16">
          {children}
        </main>

        {/* Desktop Table of Contents */}
        {headings.length > 0 && <DocsToc headings={headings} />}
      </div>
    </div>
  );
}
