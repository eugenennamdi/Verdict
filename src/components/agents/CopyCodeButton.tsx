"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (typeof window !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:text-white active:scale-[0.98]"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5 text-slate-400" />
          <span>Copy TypeScript example</span>
        </>
      )}
    </button>
  );
}
