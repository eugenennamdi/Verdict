"use client";

import { ArrowUpRight, Zap, Layers, Cpu } from "lucide-react";

type StarterItem = {
  id: string;
  title: string;
  desc: string;
  prompt: string;
  icon: typeof Zap;
};

const STARTER_ITEMS: StarterItem[] = [
  {
    id: "cal",
    title: "Audit Cal.com",
    desc: "Scheduling infrastructure & conversion flow",
    prompt: "cal.com",
    icon: Zap,
  },
  {
    id: "linear",
    title: "Audit Linear.app",
    desc: "Positioning & friction in dev tools",
    prompt: "linear.app",
    icon: Zap,
  },
  {
    id: "framework",
    title: "7-Pillar Framework",
    desc: "How Verdict scores growth readiness",
    prompt: "How does scoring work?",
    icon: Layers,
  },
  {
    id: "agent",
    title: "Agent Architecture",
    desc: "Headless DOM ingestion & intelligence",
    prompt: "What can you do?",
    icon: Cpu,
  },
];

type SuggestionChipsProps = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function SuggestionChips({ onSelect, disabled }: SuggestionChipsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left font-sans">
      {STARTER_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.prompt)}
            className="group flex items-start justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/90 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/80"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-slate-900 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
                  {item.title}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-1">
                {item.desc}
              </p>
            </div>
            <ArrowUpRight className="size-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:text-orange-500 transition-all shrink-0 mt-0.5" />
          </button>
        );
      })}
    </div>
  );
}

