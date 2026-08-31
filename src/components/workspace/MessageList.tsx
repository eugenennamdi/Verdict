"use client";

import type { WorkspaceMessage } from "./types";
import { AuditResultCard } from "./AuditResultCard";
import { InvestigationError } from "./InvestigationError";
import type { ActivityEvent } from "@/lib/audit/events";
import { FormattedMessage } from "./FormattedMessage";
import { VerdictLogo } from "./AppSidebar";
import { AgentLoadingState } from "./AgentLoadingState";
import { InvestigationTrace } from "./InvestigationTrace";

type MessageListProps = {
  messages: WorkspaceMessage[];
  liveEvents: ActivityEvent[];
  investigating: boolean;
  pendingReply?: boolean;
  pendingReplyMode?: "thinking" | "followup";
  activeDomain?: string;
  startTime?: number | null;
  onOpenRightPanel?: () => void;
  onRetry?: () => void;
};

function sourceLabel(
  path: string,
  role?: "homepage" | "supporting",
  category?: string
): string {
  if (role === "homepage") return "Homepage";
  const segment = path.split("/").filter(Boolean).at(-1);
  const value = segment || category || (role === "supporting" ? "Supporting page" : "Source");
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactSourceUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function MessageList({
  messages,
  liveEvents,
  investigating,
  pendingReply,
  pendingReplyMode = "thinking",
  activeDomain,
  startTime,
  onOpenRightPanel,
  onRetry,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-6">
      {messages.map((message) => {
        // User Message: Small, restrained, right-aligned
        if (message.kind === "text" && message.role === "user") {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-slate-900 px-4 py-2.5 text-[14px] leading-relaxed text-white dark:bg-slate-800 dark:text-slate-100 shadow-2xs">
                {message.content}
              </div>
            </div>
          );
        }

        // Verdict Editorial Text Response
        if (message.kind === "text" && message.role === "verdict") {
          return (
            <div key={message.id} className="flex items-start gap-3 max-w-[95%]">
              <div className="flex size-5 shrink-0 items-center justify-center text-orange-500 mt-0.5">
                <VerdictLogo className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <FormattedMessage
                  content={
                    message.auditQa
                      ? message.content
                          .replace(/\s*\[(?:source\s+)?S\d+\]/gi, "")
                          .replace(/\b(?:source\s+)?S\d+\s*·?\s*/gi, "")
                      : message.content
                  }
                />
                {message.auditQa &&
                  (message.auditQa.citations.length > 0 ||
                    message.auditQa.limitations.length > 0) && (
                    <div className="mt-3 space-y-2">
                      {message.auditQa.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.auditQa.citations.map((source) => (
                            <a
                              key={`${message.id}-${source.sourceId}`}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                            >
                              <span className="block font-bold text-slate-800 dark:text-slate-100">
                                Source · {sourceLabel(source.path, source.role, source.category)}
                              </span>
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                {compactSourceUrl(source.url)}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                      {message.auditQa.limitations.length > 0 && (
                        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {message.auditQa.limitations.join(" ")}
                        </p>
                      )}
                    </div>
                  )}
              </div>
            </div>
          );
        }

        // Grounded Intelligence & Tool Telemetry beneath report
        if (message.kind === "trace") {
          return (
            <InvestigationTrace
              key={message.id}
              domain={message.domain || activeDomain}
              events={message.events}
              active={false}
            />
          );
        }

        // Result Card in Stream
        if (message.kind === "result") {
          return (
            <div key={message.id} className="space-y-4">
              <AuditResultCard
                result={message.result}
                onOpenAuditContext={onOpenRightPanel}
              />
            </div>
          );
        }

        // Error Message in Stream
        if (message.kind === "error") {
          return (
            <InvestigationError
              key={message.id}
              message={message.message}
              onRetry={onRetry}
            />
          );
        }

        return null;
      })}

      {investigating && liveEvents.length > 0 && (
        <InvestigationTrace
          events={liveEvents}
          active
          domain={activeDomain}
        />
      )}

      {/* Initial live state before the first operational event arrives. */}
      {investigating && liveEvents.length === 0 && (
        <AgentLoadingState
          mode="audit"
          domain={activeDomain}
          startTime={startTime}
        />
      )}

      {/* Pending Conversational Reply Indicator */}
      {pendingReply && (
        <AgentLoadingState
          mode={pendingReplyMode}
          startTime={startTime}
        />
      )}
    </div>
  );
}
