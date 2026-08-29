"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { Footer } from "@/components/footer";
import { VerdictWorkspace } from "@/components/workspace/VerdictWorkspace";

const VerdictLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
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

export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 z-0 bg-mesh opacity-60 mix-blend-multiply dark:opacity-40 dark:mix-blend-screen" />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
        }}
      />

      <header className="absolute top-0 right-0 left-0 z-50 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8 sm:px-12">
        <Link href="/" className="group flex cursor-pointer items-center gap-2">
          <VerdictLogo className="h-8 w-8 text-orange-500 transition-transform group-hover:scale-105" />
          <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            VERDICT
          </span>
        </Link>
        <Link
          href="/agents"
          className="group flex items-center gap-2 rounded-lg border border-slate-200/50 bg-white/50 px-5 py-2.5 text-[13px] font-bold text-orange-500 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:text-orange-600 dark:border-slate-800/50 dark:bg-slate-900/50 dark:hover:bg-slate-800/80 dark:hover:text-orange-400"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">For Agents</span>
          <span className="sm:hidden">Agents</span>
        </Link>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <VerdictWorkspace />
      </div>

      <Footer />
    </div>
  );
}
