export const ACTIVITY_EVENT_TYPES = [
  "audit.started",
  "site.homepage_acquired",
  "site.pages_discovered",
  "evidence.selected",
  "evidence.acquired",
  "evidence.insufficient",
  "evidence.sufficient",
  "startup.identified",
  "scoring.started",
  "report.persisted",
  "audit.completed",
  "audit.failed",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export type ActivityEvent = {
  type: ActivityEventType;
  ts: number;
  message: string;
  data?: Record<string, unknown>;
};

export type EventEmitter = (event: ActivityEvent) => void;

const DEFAULT_MESSAGES: Record<ActivityEventType, string> = {
  "audit.started": "Investigation started",
  "site.homepage_acquired": "Homepage acquired",
  "site.pages_discovered": "Candidate URLs retained",
  "evidence.selected": "Evidence page selected",
  "evidence.acquired": "Evidence page acquired",
  "evidence.insufficient": "More evidence needed",
  "evidence.sufficient": "Evidence coverage sufficient",
  "startup.identified": "Startup identified",
  "scoring.started": "Computing growth readiness",
  "report.persisted": "Report saved",
  "audit.completed": "Investigation complete",
  "audit.failed": "Investigation failed",
};

export function createTracer(onEvent?: EventEmitter) {
  const events: ActivityEvent[] = [];

  function emit(
    type: ActivityEventType,
    message?: string,
    data?: Record<string, unknown>
  ): ActivityEvent {
    const event: ActivityEvent = {
      type,
      ts: Date.now(),
      message: message || DEFAULT_MESSAGES[type],
      ...(data ? { data } : {}),
    };
    events.push(event);
    onEvent?.(event);
    return event;
  }

  return { events, emit };
}

export type Tracer = ReturnType<typeof createTracer>;
