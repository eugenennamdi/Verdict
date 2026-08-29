"use client";

import Link from "next/link";
import type { WorkspaceMessage } from "./types";
import { InvestigationTrace } from "./InvestigationTrace";
import { AuditResultCard } from "./AuditResultCard";
import type { ActivityEvent } from "@/lib/audit/events";

function linkify(text: string) {
  const parts = text.split(/(\/docs(?:\/[a-z0-9\-]+)?)/gi);
  return parts.map((part, index) => {
    if (part.startsWith("/docs")) {
      return (
        <Link
          key={`${part}-${index}`}
          href={part}
          className="font-semibold text-orange-500 hover:text-orange-600"
        >
          {part}
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

type MessageListProps = {
  messages: WorkspaceMessage[];
  liveEvents: ActivityEvent[];
  investigating: boolean;
  pendingReply?: boolean;
};

export function MessageList({
  messages,
  liveEvents,
  investigating,
  pendingReply,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-5">
      {messages.map((message) => {
        if (message.kind === "text" && message.role === "user") {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-slate-900 px-4 py-2.5 text-[14px] leading-relaxed text-white dark:bg-white dark:text-slate-900">
                {message.content}
              </div>
            </div>
          );
        }

        if (message.kind === "text") {
          return (
            <div key={message.id} className="max-w-[92%] whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
              {linkify(message.content)}
            </div>
          );
        }

        if (message.kind === "trace") {
          return (
            <InvestigationTrace
              key={message.id}
              events={message.events}
              active={false}
            />
          );
        }

        if (message.kind === "result") {
          return (
            <div key={message.id} className="space-y-4">
              <p className="max-w-[92%] whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
                {message.summary}
              </p>
              <AuditResultCard result={message.result} />
            </div>
          );
        }

        return null;
      })}

      {investigating && (
        <InvestigationTrace events={liveEvents} active />
      )}

      {pendingReply && (
        <p className="text-[13px] text-slate-400 dark:text-slate-500" aria-live="polite">
          <span className="inline-flex gap-1">
            <span className="size-1.5 animate-pulse rounded-full bg-slate-400 motion-reduce:animate-none" />
            <span className="size-1.5 animate-pulse rounded-full bg-slate-400 delay-150 motion-reduce:animate-none" />
            <span className="size-1.5 animate-pulse rounded-full bg-slate-400 delay-300 motion-reduce:animate-none" />
          </span>
          <span className="sr-only">Verdict is responding</span>
        </p>
      )}
    </div>
  );
}
