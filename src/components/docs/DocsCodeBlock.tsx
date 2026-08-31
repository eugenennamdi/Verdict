"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface DocsCodeBlockProps {
  children: string;
  language?: string;
  filename?: string;
  highlightLines?: number[];
}

export function DocsCodeBlock({
  children,
  language = "bash",
  filename,
}: DocsCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="group relative my-4.5 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950 shadow-xs">
      {(filename || language) && (
        <div className="flex h-9 items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4">
          <div className="flex items-center gap-2">
            {filename ? (
              <span className="font-mono text-xs font-medium text-slate-300">
                {filename}
              </span>
            ) : (
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {language}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
            className="flex size-6 items-center justify-center rounded-md border border-slate-700/60 bg-slate-800/80 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            {copied ? (
              <Check className="size-3 text-emerald-400" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </div>
      )}

      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-200 selection:bg-orange-500/25 selection:text-white">
        <code>{children.trim()}</code>
      </pre>
    </div>
  );
}
