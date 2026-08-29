"use client";

import { useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import type { ActivityEvent } from "@/lib/audit/events";
import { extractStartupUrl, FALLBACK_REPLY, rateLimitReply } from "@/lib/conversation/intents";
import { Composer } from "./Composer";
import { SuggestionChips } from "./SuggestionChips";
import { MessageList } from "./MessageList";
import { readInvestigateStream } from "./sse";
import type { AuditSummary, WorkspaceMessage, WorkspacePhase } from "./types";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function conversationalSummary(result: AuditSummary): string {
  const company = result.identity?.company_name || result.company_name || "This startup";
  const score = result.overallScore;
  const constraint = result.the_verdict?.primary_constraint;
  const interpretation = result.score_interpretation;
  const lines = [`${company} scores ${score}/100 on Growth Readiness.`];
  if (constraint) lines.push(`The primary bottleneck is ${constraint.replace(/\.$/, "")}.`);
  else if (interpretation) lines.push(interpretation);
  lines.push("The full breakdown is in the report.");
  return lines.join(" ");
}

export function VerdictWorkspace() {
  const posthog = usePostHog();
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<WorkspacePhase>("idle");
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);
  const [hasCompletedAudit, setHasCompletedAudit] = useState(false);
  const [conversing, setConversing] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | undefined>();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const liveEventsRef = useRef<ActivityEvent[]>([]);
  const inFlightRef = useRef(false);

  const investigating = phase === "investigating";
  const busy = investigating || conversing;

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, liveEvents, phase]);

  const push = (message: WorkspaceMessage) => {
    setMessages((current) => [...current, message]);
  };

  const reply = (content: string) => {
    push({ id: nextId(), role: "verdict", kind: "text", content });
  };

  const runInvestigation = async (url: string) => {
    setPhase("investigating");
    liveEventsRef.current = [];
    setLiveEvents([]);
    posthog?.capture("audit_started", { url });

    try {
      const response = await fetch("/api/engine/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ url }),
      });

      if (response.status === 429) {
        let retryAfterSeconds: number | undefined;
        try {
          const payload = await response.json();
          retryAfterSeconds = payload.retryAfterSeconds;
        } catch {
          retryAfterSeconds = undefined;
        }
        setPhase(hasCompletedAudit ? "complete" : "idle");
        reply(rateLimitReply(retryAfterSeconds));
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Investigation failed." }));
        setPhase(hasCompletedAudit ? "complete" : "idle");
        posthog?.capture("audit_failed", { url, error: payload.error });
        reply(payload.error || "I couldn't complete that investigation. Please try another URL.");
        return;
      }

      await readInvestigateStream(response, {
        onEvent: (event) => {
          liveEventsRef.current = [...liveEventsRef.current, event];
          setLiveEvents(liveEventsRef.current);
        },
        onResult: (result) => {
          push({
            id: nextId(),
            role: "verdict",
            kind: "trace",
            events: liveEventsRef.current,
          });
          liveEventsRef.current = [];
          setLiveEvents([]);
          push({
            id: nextId(),
            role: "verdict",
            kind: "result",
            summary: conversationalSummary(result),
            result,
          });
          setHasCompletedAudit(true);
          if (result.reportId) setActiveReportId(result.reportId);
          setPhase("complete");
          posthog?.capture("audit_completed", {
            url,
            report_id: result.reportId,
            score: result.overallScore,
          });
        },
        onError: (error) => {
          if (liveEventsRef.current.length > 0) {
            push({
              id: nextId(),
              role: "verdict",
              kind: "trace",
              events: liveEventsRef.current,
            });
          }
          liveEventsRef.current = [];
          setLiveEvents([]);
          setPhase(hasCompletedAudit ? "complete" : "idle");
          posthog?.capture("audit_failed", { url, error });
          reply(error || "I couldn't complete that investigation.");
        },
      });
    } catch (error: unknown) {
      setPhase(hasCompletedAudit ? "complete" : "idle");
      posthog?.capture("audit_failed", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      reply("The investigation stream was interrupted. Please try again.");
    }
  };

  const handleSend = (raw: string) => {
    const text = raw.trim();
    if (!text || busy || inFlightRef.current) return;

    setDraft("");
    const userMessage: WorkspaceMessage = {
      id: nextId(),
      role: "user",
      kind: "text",
      content: text,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    posthog?.capture("workspace_message_sent", { length: text.length });

    const url = extractStartupUrl(text);
    if (url) {
      posthog?.capture("audit_intent", { source: "url" });
      void runInvestigation(url);
      return;
    }

    posthog?.capture("conversation_message");
    void askVerdict(nextMessages);
  };

  const askVerdict = async (thread: WorkspaceMessage[]) => {
    inFlightRef.current = true;
    setConversing(true);
    try {
      const history = thread
        .filter((message): message is Extract<WorkspaceMessage, { kind: "text" }> => message.kind === "text")
        .slice(-10)
        .map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          content: message.content,
        }));

      const response = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          activeReportId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        action?: string;
        message?: string;
        url?: string | null;
      } | null;

      if (payload?.action === "start_audit" && payload.url) {
        posthog?.capture("audit_intent", { source: "conversation" });
        if (payload.message) reply(payload.message);
        await runInvestigation(payload.url);
        return;
      }

      reply(payload?.message || FALLBACK_REPLY);
    } catch {
      reply(FALLBACK_REPLY);
    } finally {
      setConversing(false);
      inFlightRef.current = false;
    }
  };

  const idle = messages.length === 0 && !busy;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {idle ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-10 pt-24">
          <div className="w-full max-w-xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-500">
              Verdict
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              What should I investigate?
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
              Paste a startup URL. I&apos;ll inspect the site and return a Growth Readiness score with a shareable report.
            </p>
            <div className="mt-8 text-left">
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={() => handleSend(draft)}
                investigating={busy}
              />
            </div>
            <div className="mt-5">
              <SuggestionChips onSelect={handleSend} disabled={busy} />
            </div>
            <a
              href="https://www.producthunt.com/products/verdict-7"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-1.5 text-[11px] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              Live on Product Hunt
            </a>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-24">
            <div className="mx-auto w-full max-w-xl">
              <MessageList
                messages={messages}
                liveEvents={liveEvents}
                investigating={investigating}
                pendingReply={conversing}
              />
            </div>
          </div>
          <div className="shrink-0 border-t border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/80">
            <div className="mx-auto w-full max-w-xl">
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={() => handleSend(draft)}
                investigating={busy}
                placeholder={
                  investigating
                    ? "Investigation in progress..."
                    : conversing
                      ? "Verdict is responding..."
                      : "Ask Verdict or paste another URL..."
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
