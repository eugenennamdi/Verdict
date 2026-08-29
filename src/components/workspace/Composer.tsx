"use client";

import { useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  investigating?: boolean;
  placeholder?: string;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  investigating,
  placeholder = "Ask Verdict anything or paste a startup URL...",
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (disabled || investigating || !value.trim()) return;
    onSubmit();
  };

  return (
    <div className="relative">
      <label htmlFor="verdict-composer" className="sr-only">
        Message Verdict
      </label>
      <Textarea
        id="verdict-composer"
        ref={ref}
        value={value}
        disabled={disabled || investigating}
        placeholder={placeholder}
        rows={1}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="min-h-[56px] max-h-40 resize-none rounded-2xl border-slate-200 bg-white/90 px-4 py-3.5 pr-14 text-[15px] leading-relaxed shadow-sm placeholder:text-slate-400 focus-visible:border-orange-500/40 focus-visible:ring-orange-500/20 dark:border-slate-800 dark:bg-slate-900/80 dark:placeholder:text-slate-500"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || investigating || !value.trim()}
        aria-label={investigating ? "Investigation in progress" : "Send message"}
        className="absolute right-2.5 bottom-2.5 inline-flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm transition-colors hover:bg-orange-600 disabled:pointer-events-none disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      >
        {investigating ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <ArrowUp className="size-4" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
