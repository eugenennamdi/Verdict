"use client";

import { useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import type { ActivityEvent } from "@/lib/audit/events";
import { extractStartupUrl, FALLBACK_REPLY, rateLimitReply } from "@/lib/conversation/intents";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { AppSidebar, VerdictLogo } from "./AppSidebar";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { ContextualPanel } from "./ContextualPanel";
import { readInvestigateStream } from "./sse";
import type { AuditSummary, RecentInvestigation, WorkspaceMessage, WorkspacePhase } from "./types";
import { conversationalAuditSummary } from "./investigationPresentation";

const RECENTS_KEY = "verdict_recent_investigations";

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractDomain(rawUrl: string): string {
  try {
    const formatted = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(formatted);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function compactRecentResult(result: AuditSummary): AuditSummary {
  const {
    evidence: _evidence,
    evidenceCoverage: _evidenceCoverage,
    finalCoverage: _finalCoverage,
    budgetUsage: _budgetUsage,
    investigation: _investigation,
    stopReason: _stopReason,
    ...compact
  } = result;
  return compact;
}

export function VerdictWorkspace() {
  const posthog = usePostHog();
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<WorkspacePhase>("idle");
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [hasCompletedAudit, setHasCompletedAudit] = useState(false);
  const [conversing, setConversing] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | undefined>();
  const [activeUrl, setActiveUrl] = useState<string | undefined>();
  const [activeDomain, setActiveDomain] = useState<string | undefined>();
  const [activeCompany, setActiveCompany] = useState<string | undefined>();
  const [activeScore, setActiveScore] = useState<number | undefined>();
  const [activeResult, setActiveResult] = useState<AuditSummary | undefined>();
  const [startTime, setStartTime] = useState<number | null>(null);

  // Layout states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isMobileRightPanelOpen, setIsMobileRightPanelOpen] = useState(false);

  // Recents
  const [recents, setRecents] = useState<RecentInvestigation[]>([]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const liveEventsRef = useRef<ActivityEvent[]>([]);
  const inFlightRef = useRef(false);

  const investigating = phase === "investigating";
  const busy = investigating || conversing;

  // Load recents on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as RecentInvestigation[];
        const compact = stored.map((item) => ({
          ...item,
          ...(item.result ? { result: compactRecentResult(item.result) } : {}),
          messages: undefined,
        }));
        setRecents(compact);
        localStorage.setItem(RECENTS_KEY, JSON.stringify(compact));
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-scroll message stream
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, liveEvents, phase]);

  const saveRecentItem = (url: string, result: AuditSummary) => {
    const domain = extractDomain(url);
    const company = result.identity?.company_name || result.company_name || domain;
    const summary = conversationalAuditSummary(result);

    const item: RecentInvestigation = {
      id: nextId(),
      url,
      domain,
      companyName: company,
      score: result.overallScore,
      reportId: result.reportId,
      timestamp: Date.now(),
      result: compactRecentResult(result),
      summary,
    };

    setRecents((prev) => {
      const filtered = prev.filter((r) => r.url !== url);
      const updated = [item, ...filtered].slice(0, 25);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleRemoveRecent = (id: string) => {
    setRecents((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleSelectRecent = (item: RecentInvestigation) => {
    if (busy || inFlightRef.current) return;

    if (item.result) {
      // Restore audit instantly without re-running backend investigation
      setDraft("");
      setPhase("complete");
      setActiveUrl(item.url);
      setActiveDomain(item.domain);
      setActiveCompany(item.companyName);
      setActiveScore(item.score);
      setActiveReportId(item.reportId);
      setActiveResult(item.result);
      setLiveEvents([]);
      setActivityEvents([]);
      liveEventsRef.current = [];

      const restoredMessages: WorkspaceMessage[] = [
        { id: nextId(), role: "user", kind: "text", content: item.url },
        {
          id: nextId(),
          role: "verdict",
          kind: "result",
          summary:
            item.summary ||
            `${item.companyName} scores ${item.score}/100 on Growth Readiness. The full breakdown is in the report.`,
          result: item.result,
          domain: item.domain,
        },
      ];

      setMessages(restoredMessages);
      setIsRightPanelOpen(true);
      setHasCompletedAudit(true);
    } else {
      // Fallback only if no cached audit result
      handleSend(item.url);
    }
  };

  const handleNewInvestigation = () => {
    setDraft("");
    setPhase("idle");
    setMessages([]);
    setLiveEvents([]);
    setActivityEvents([]);
    liveEventsRef.current = [];
    setActiveReportId(undefined);
    setActiveUrl(undefined);
    setActiveDomain(undefined);
    setActiveCompany(undefined);
    setActiveScore(undefined);
    setActiveResult(undefined);
    setStartTime(null);
    setIsRightPanelOpen(false);
    setIsMobileRightPanelOpen(false);
  };

  const push = (message: WorkspaceMessage) => {
    setMessages((current) => [...current, message]);
  };

  const reply = (content: string) => {
    push({ id: nextId(), role: "verdict", kind: "text", content });
  };

  const runInvestigation = async (url: string) => {
    const domain = extractDomain(url);
    setActiveUrl(url);
    setActiveDomain(domain);
    setActiveCompany(undefined);
    setActiveScore(undefined);
    setActiveResult(undefined);
    setStartTime(Date.now());
    setPhase("investigating");
    setIsRightPanelOpen(true); // Auto-opens during active investigation
    liveEventsRef.current = [];
    setLiveEvents([]);
    setActivityEvents([]);
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
        push({
          id: nextId(),
          role: "verdict",
          kind: "error",
          message: payload.error || "I couldn't complete that investigation. Please check the URL and try again.",
          domain,
        });
        return;
      }

      await readInvestigateStream(response, {
        onEvent: (event) => {
          liveEventsRef.current = [...liveEventsRef.current, event];
          setLiveEvents(liveEventsRef.current);
          setActivityEvents(liveEventsRef.current);
        },
        onResult: (result) => {
          const company = result.identity?.company_name || result.company_name || domain;
          setActiveCompany(company);
          setActiveScore(result.overallScore);
          setActiveResult(result);

          const traceMsg: WorkspaceMessage = {
            id: nextId(),
            role: "verdict",
            kind: "trace",
            events: liveEventsRef.current,
            domain,
          };
          const resultMsg: WorkspaceMessage = {
            id: nextId(),
            role: "verdict",
            kind: "result",
            summary: conversationalAuditSummary(result),
            result,
            domain,
          };

          setMessages((current) => {
            const nextList = [...current, resultMsg, traceMsg];
            saveRecentItem(url, result);
            return nextList;
          });

          liveEventsRef.current = [];
          setLiveEvents([]);
          setHasCompletedAudit(true);
          if (result.reportId) setActiveReportId(result.reportId);
          setPhase("complete");
          setIsRightPanelOpen(true);
          posthog?.capture("audit_completed", {
            url,
            report_id: result.reportId,
            score: result.overallScore,
          });
        },
        onError: (error) => {
          if (liveEventsRef.current.length > 0) {
            setActivityEvents(liveEventsRef.current);
            push({
              id: nextId(),
              role: "verdict",
              kind: "trace",
              events: liveEventsRef.current,
              domain,
            });
          }
          liveEventsRef.current = [];
          setLiveEvents([]);
          setPhase(hasCompletedAudit ? "complete" : "idle");
          posthog?.capture("audit_failed", { url, error });
          push({
            id: nextId(),
            role: "verdict",
            kind: "error",
            message: error || "The investigation encountered an error and could not complete.",
            domain,
          });
        },
      });
    } catch (error: unknown) {
      setPhase(hasCompletedAudit ? "complete" : "idle");
      posthog?.capture("audit_failed", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      push({
        id: nextId(),
        role: "verdict",
        kind: "error",
        message: "The investigation stream was interrupted. Please try again.",
        domain,
      });
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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950">
      {/* 1. Left Sidebar */}
      <AppSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onNewInvestigation={handleNewInvestigation}
        recents={recents}
        onSelectRecent={handleSelectRecent}
        onRemoveRecent={handleRemoveRecent}
        activeUrl={activeUrl}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Center Workspace */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors">
        {/* Workspace Top Bar */}
        <WorkspaceTopBar
          phase={phase}
          targetDomain={activeDomain}
          companyName={activeCompany}
          hasEvents={liveEvents.length > 0 || (activeResult !== undefined)}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={() => {
            setIsRightPanelOpen((prev) => !prev);
            setIsMobileRightPanelOpen((prev) => !prev);
          }}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Workspace Content */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {idle ? (
            /* Idle Screen: Focused, Software waiting for work */
            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-6">
              <div className="w-full max-w-xl text-center">
                <div className="mx-auto flex items-center justify-center">
                  <VerdictLogo className="size-9 text-orange-500" />
                </div>
                <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  What startup are we auditing today?
                </h1>
                <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Paste any startup URL to run a 60-second growth due diligence audit across 7 pillars.
                </p>

                <div className="mt-7 text-left">
                  <Composer
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => handleSend(draft)}
                    investigating={busy}
                    placeholder="Enter a startup URL (e.g. linear.app, stripe.com) or ask anything..."
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Active Conversation / Investigation Stream */
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto w-full max-w-2xl">
                  <MessageList
                    messages={messages}
                    liveEvents={liveEvents}
                    investigating={investigating}
                    pendingReply={conversing}
                    activeDomain={activeDomain}
                    startTime={startTime}
                    onOpenRightPanel={() => {
                      setIsRightPanelOpen(true);
                      setIsMobileRightPanelOpen(true);
                    }}
                    onRetry={() => {
                      if (activeUrl) setDraft(activeUrl);
                    }}
                  />
                </div>
              </div>

              {/* Anchored Bottom Composer */}
              <div className="shrink-0 border-t border-slate-200/80 bg-white/90 px-4 py-3.5 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
                <div className="mx-auto w-full max-w-2xl">
                  <Composer
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => handleSend(draft)}
                    investigating={busy}
                    targetDomain={activeDomain}
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
      </main>

      {/* 3. Contextual Investigation Panel (Right Side) */}
      <ContextualPanel
        phase={phase}
        events={liveEvents.length > 0 ? liveEvents : activityEvents}
        startTime={startTime}
        targetUrl={activeUrl}
        targetDomain={activeDomain}
        auditResult={activeResult}
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        isMobileOpen={isMobileRightPanelOpen}
        onMobileClose={() => setIsMobileRightPanelOpen(false)}
      />
    </div>
  );
}
