"use client";

import { VerdictWorkspace } from "@/components/workspace/VerdictWorkspace";

export default function Home() {
  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <VerdictWorkspace />
    </div>
  );
}

