"use client";

const CHIPS = [
  { id: "audit", label: "Audit a startup", prompt: "Audit a startup" },
  { id: "capabilities", label: "What can you do?", prompt: "What can you do?" },
  { id: "scoring", label: "How does scoring work?", prompt: "How does scoring work?" },
  { id: "example", label: "View an example audit", prompt: "View an example audit" },
] as const;

type SuggestionChipsProps = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function SuggestionChips({ onSelect, disabled }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(chip.prompt)}
          className="rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
