"use client";

import {
  Menu,
} from "lucide-react";
import type { WorkspacePhase } from "./types";
import { HumanWalletButton } from "./HumanWalletButton";

type WorkspaceTopBarProps = {
  phase: WorkspacePhase;
  targetDomain?: string;
  companyName?: string;
  hasEvents: boolean;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onOpenMobileSidebar: () => void;
};

export function WorkspaceTopBar({
  phase,
  targetDomain,
  companyName,
  hasEvents,
  isRightPanelOpen,
  onToggleRightPanel,
  onOpenMobileSidebar,
}: WorkspaceTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
      {/* Left: Mobile Nav Toggle & Context Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="sm:hidden inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Open sidebar"
        >
          <Menu className="size-4" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          {phase === "idle" ? (
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-slate-900 dark:text-white">
                New Audit
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-[14px] font-bold text-slate-900 dark:text-white">
                {companyName || targetDomain || "Audit"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <HumanWalletButton />
      </div>
    </header>
  );
}
