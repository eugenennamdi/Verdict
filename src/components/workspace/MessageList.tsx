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
  activeDomain?: string;
  startTime?: number | null;
  onOpenRightPanel?: () => void;
  onRetry?: () => void;
};

export function MessageList({
  messages,
  liveEvents,
  investigating,
  pendingReply,
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
                <FormattedMessage content={message.content} />
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
              onOpenPanel={onOpenRightPanel}
            />
          );
        }

        // Result Card in Stream
        if (message.kind === "result") {
          return (
            <div key={message.id} className="space-y-4">
              {message.summary && (
                <div className="flex items-start gap-3 max-w-[95%]">
                  <div className="flex size-5 shrink-0 items-center justify-center text-orange-500 mt-0.5">
                    <VerdictLogo className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <FormattedMessage content={message.summary} />
                  </div>
                </div>
              )}
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
          onOpenPanel={onOpenRightPanel}
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
          mode="thinking"
          startTime={startTime}
        />
      )}
    </div>
  );
}
