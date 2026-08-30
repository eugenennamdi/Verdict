"use client";

import { useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  investigating?: boolean;
  placeholder?: string;
  targetDomain?: string;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  investigating,
  placeholder = "Enter a startup URL (e.g. linear.app, resend.com)…",
  targetDomain,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = !disabled && !investigating && Boolean(value.trim());

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit();
  };

  return (
    <div className="relative w-full rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5 dark:border-slate-800/90 dark:bg-slate-900/90 dark:focus-within:border-slate-600 dark:focus-within:ring-white/5">
      <div className="relative flex items-end">
        <label htmlFor="verdict-composer" className="sr-only">
          Message Verdict
        </label>
        <textarea
          id="verdict-composer"
          ref={textareaRef}
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
          className="w-full min-h-[52px] max-h-44 resize-none bg-transparent px-4 py-3.5 pr-14 text-[14px] leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none focus:outline-none dark:text-white dark:placeholder:text-slate-500"
        />

        <div className="absolute right-2.5 bottom-2.5 flex items-center">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-label={investigating ? "Investigation in progress" : "Send message"}
            className={`inline-flex size-8 items-center justify-center rounded-xl transition-[background-color,color,transform] duration-150 ease-out ${
              investigating
                ? "bg-slate-100 text-slate-400 dark:bg-slate-800/90 dark:text-slate-500 cursor-wait"
                : canSubmit
                  ? "bg-orange-500 text-white shadow-xs hover:bg-orange-600 active:scale-[0.97] cursor-pointer"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800/90 dark:text-slate-500 cursor-not-allowed pointer-events-none"
            }`}
          >
            {investigating ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

