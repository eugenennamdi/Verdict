"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Bot,
  BookOpen,
  PanelLeft,
  MoreHorizontal,
  Sun,
  Moon,
  Monitor,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { HumanAuditQuotaIndicator } from "./HumanAuditQuotaIndicator";
import type { RecentInvestigation } from "./types";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import type { HumanAuditUsageStatus } from "./humanAuditUsageState";

export const VerdictLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 5L12 19L20 5"
      stroke="currentColor"
      strokeWidth="4"
      strokeMiterlimit="10"
      strokeLinecap="butt"
      strokeLinejoin="miter"
    />
  </svg>
);

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

export function CompanyLogo({
  domain,
  name,
  className = "size-4",
}: {
  domain?: string;
  name?: string;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const initial = (name || domain || "?").charAt(0).toUpperCase();

  if (!cleanDomain || error) {
    return (
      <span className={`inline-flex items-center justify-center bg-slate-200/80 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg ${className}`}>
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/proxy-logo?domain=${encodeURIComponent(cleanDomain)}`}
      alt={name || domain || "Logo"}
      className={`rounded-lg object-contain bg-white dark:bg-slate-900 ${className}`}
      onError={() => setError(true)}
    />
  );
}

type AppSidebarProps = {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewInvestigation: () => void;
  recents: RecentInvestigation[];
  onSelectRecent: (item: RecentInvestigation) => void;
  onRemoveRecent?: (id: string) => void;
  activeUrl?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  humanAuditUsage: HumanAuditUsageState | null;
  humanAuditUsageStatus?: HumanAuditUsageStatus;
};

export function AppSidebar({
  isCollapsed,
  onToggleCollapse,
  onNewInvestigation,
  recents,
  onSelectRecent,
  onRemoveRecent,
  activeUrl,
  isMobileOpen,
  onMobileClose,
  humanAuditUsage,
  humanAuditUsageStatus,
}: AppSidebarProps) {
  const { theme, setTheme } = useTheme();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    if (isMoreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMoreOpen]);

  const content = (
    <aside
      className={`flex h-full flex-col justify-between border-r border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-md transition-[width] duration-200 ease-out ${
        isCollapsed ? "w-[60px]" : "w-64"
      }`}
    >
      {/* Top Header & New Audit Action */}
      <div className={`flex flex-col ${isCollapsed ? "p-2.5 space-y-3" : "p-3 space-y-3"}`}>
        {/* Header Row */}
        {!isCollapsed ? (
          <div className="flex h-9 items-center justify-between px-1">
            <button
              type="button"
              onClick={onNewInvestigation}
              className="group flex cursor-pointer items-center gap-2 text-left outline-none"
              title="Verdict"
            >
              <VerdictLogo className="h-5 w-5 text-orange-500" />
              <span className="text-[14px] font-black tracking-tight text-slate-900 dark:text-white">
                VERDICT
              </span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden sm:inline-flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="size-4.5" />
              </button>

              {onMobileClose && (
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="sm:hidden inline-flex size-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center pt-0.5">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="size-5" />
            </button>
          </div>
        )}

        {/* Primary Action: New Audit */}
        {!isCollapsed ? (
          <button
            type="button"
            onClick={() => {
              onNewInvestigation();
              if (onMobileClose) onMobileClose();
            }}
            className="group flex w-full items-center gap-2.5 rounded-xl bg-slate-200/70 px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-900 shadow-2xs transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-200 dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-700/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 dark:focus-visible:ring-white/20"
            title="New Audit"
          >
            <Plus className="size-4 text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
            <span>New Audit</span>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                onNewInvestigation();
                if (onMobileClose) onMobileClose();
              }}
              className="flex size-9 items-center justify-center rounded-xl bg-slate-200/70 text-slate-900 shadow-2xs transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-200 dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-700/80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 dark:focus-visible:ring-white/20"
              title="New Audit"
            >
              <Plus className="size-4.5 text-slate-800 dark:text-slate-200" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* Middle: Recents Section */}
      {!isCollapsed ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 py-1">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Recent Audits
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-1 pr-1">
            {recents.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-slate-400 dark:text-slate-600">
                  No recent audits yet
                </p>
              </div>
            ) : (
              recents.map((item) => {
                const isActive = activeUrl === item.url;
                return (
                  <div
                    key={item.id}
                    className={`group relative flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-150 ${
                      isActive
                        ? "bg-slate-200/70 dark:bg-slate-800/90 text-slate-900 dark:text-white font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRecent(item);
                        onMobileClose?.();
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <CompanyLogo domain={item.domain} name={item.companyName} className="size-4 shrink-0 rounded-md" />
                        <span className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                          {item.companyName || item.domain}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pl-6">
                        <span className="truncate">{item.domain}</span>
                        <span>·</span>
                        <span className="shrink-0">{formatRelativeTime(item.timestamp)}</span>
                      </div>
                    </button>

                    {onRemoveRecent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 dark:text-slate-500 transition-opacity duration-150"
                        title="Remove from recents"
                        aria-label="Remove audit"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-1 py-1">
          {recents.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectRecent(item)}
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 dark:border-slate-800 dark:bg-slate-900 transition-colors duration-150 group"
              title={item.companyName || item.domain}
            >
              <CompanyLogo domain={item.domain} name={item.companyName} className="size-5.5 rounded-md" />
            </button>
          ))}
        </div>
      )}

      {/* Bottom Nav: For Agents & Documentation */}
      <div className={`border-t border-slate-200/80 dark:border-slate-800/80 ${isCollapsed ? "p-2 space-y-2" : "p-2.5 space-y-2"}`}>
        <HumanAuditQuotaIndicator
          usage={humanAuditUsage}
          status={humanAuditUsageStatus}
          compact={isCollapsed}
        />

        {!isCollapsed ? (
          <div className="flex flex-col gap-0.5">
            <Link
              href="/agents"
              onClick={() => onMobileClose?.()}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
              title="For Agents (API & SDK)"
            >
              <Bot className="size-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <span>For Agents</span>
            </Link>

            <Link
              href="/docs"
              onClick={() => onMobileClose?.()}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
              title="Documentation"
            >
              <BookOpen className="size-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <span>Documentation</span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Link
              href="/agents"
              onClick={() => onMobileClose?.()}
              className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white transition-colors"
              title="For Agents (API & SDK)"
            >
              <Bot className="size-4" />
            </Link>

            <Link
              href="/docs"
              onClick={() => onMobileClose?.()}
              className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white transition-colors"
              title="Documentation"
            >
              <BookOpen className="size-4" />
            </Link>
          </div>
        )}

        {/* Footer Controls: Theme & More Menu */}
        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              {/* Theme Toggle */}
              {mounted ? (
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-200/60 p-0.5 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`size-6 rounded-md flex items-center justify-center transition-colors ${
                      theme === "system"
                        ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                    title="System theme"
                    aria-label="System theme"
                  >
                    <Monitor className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`size-6 rounded-md flex items-center justify-center transition-colors ${
                      theme === "light"
                        ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                    title="Light theme"
                    aria-label="Light theme"
                  >
                    <Sun className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`size-6 rounded-md flex items-center justify-center transition-colors ${
                      theme === "dark"
                        ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                    title="Dark theme"
                    aria-label="Dark theme"
                  >
                    <Moon className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="h-7 w-20 rounded-lg bg-slate-200/60 dark:bg-slate-900" />
              )}

              {/* More Menu Dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((prev) => !prev)}
                  className={`flex size-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white transition-colors ${
                    isMoreOpen ? "bg-slate-200/60 dark:bg-slate-900 text-slate-900 dark:text-white" : ""
                  }`}
                  title="More options"
                  aria-expanded={isMoreOpen}
                  aria-haspopup="true"
                >
                  <MoreHorizontal className="size-4" />
                </button>

                {isMoreOpen && (
                  <div className="absolute right-0 bottom-10 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-1 text-[13px]">
                      <a
                        href="https://x.com/tryverdict"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span>Follow on X</span>
                        <ExternalLink className="size-3 text-slate-400" />
                      </a>

                      <a
                        href="https://github.com/eugenennamdi/verdict"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span>GitHub</span>
                        <ExternalLink className="size-3 text-slate-400" />
                      </a>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      <a
                        href="https://eugenennamdi.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://eugenennamdi.com/favicon.png"
                          alt="Eugene Nnamdi"
                          className="size-4 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik0xMiAxMGEyIDIgMCAxIDAgMC00IDIgMiAwIDAgMCAwIDR6Ii8+PHBhdGggZD0iTTcuNCAxOGE1IDUgMCAwIDEgOS4yIDB6Ii8+PC9zdmc+";
                          }}
                        />
                        <span>Built by Eugene Nnamdi</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white transition-colors"
                title="Toggle theme"
              >
                {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </button>

              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen((prev) => !prev)}
                  className={`flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white transition-colors ${
                    isMoreOpen ? "bg-slate-200/60 dark:bg-slate-900 text-slate-900 dark:text-white" : ""
                  }`}
                  title="More options"
                  aria-expanded={isMoreOpen}
                  aria-haspopup="true"
                >
                  <MoreHorizontal className="size-4" />
                </button>

                {isMoreOpen && (
                  <div className="absolute left-11 bottom-0 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-1 text-[13px]">
                      <a
                        href="https://x.com/tryverdict"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span>Follow on X</span>
                        <ExternalLink className="size-3 text-slate-400" />
                      </a>

                      <a
                        href="https://github.com/eugenennamdi/verdict"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl px-2.5 py-2 font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span>GitHub</span>
                        <ExternalLink className="size-3 text-slate-400" />
                      </a>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      <a
                        href="https://eugenennamdi.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="https://eugenennamdi.com/favicon.png"
                          alt="Eugene Nnamdi"
                          className="size-4 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik0xMiAxMGEyIDIgMCAxIDAgMC00IDIgMiAwIDAgMCAwIDR6Ii8+PHBhdGggZD0iTTcuNCAxOGE1IDUgMCAwIDEgOS4yIDB6Ii8+PC9zdmc+";
                          }}
                        />
                        <span>Built by Eugene Nnamdi</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden sm:block h-full shrink-0">{content}</div>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[80vw] shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
