"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAVIGATION } from "@/lib/docs/navigation";

interface DocsSidebarProps {
  onLinkClick?: () => void;
}

export function DocsSidebar({ onLinkClick }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-8 text-sm" aria-label="Documentation navigation">
      {DOCS_NAVIGATION.map((group) => (
        <div key={group.title} className="space-y-2.5">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2.5">
            {group.title}
          </h3>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/docs" && pathname?.startsWith(item.href));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onLinkClick}
                    className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13.5px] transition-colors ${
                      isActive
                        ? "bg-orange-500/10 font-semibold text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-white"
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                    {item.badge && (
                      <span className="rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
