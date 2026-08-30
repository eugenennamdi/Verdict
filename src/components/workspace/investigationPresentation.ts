import type { ActivityEvent, ActivityEventType } from "@/lib/audit/events";
import {
  EVIDENCE_CATEGORIES,
  type EvidenceCategory,
  type EvidenceCoverageAssessment,
  type EvidencePageSummary,
} from "@/lib/audit/evidence";
import type { EvidenceGatherStopReason } from "@/lib/audit/gather";
import type { AuditSummary } from "./types";

export type InvestigationActivityRow = {
  type: ActivityEventType;
  label: string;
  detail?: string;
  tone: "complete" | "active" | "warning" | "failed";
};

export type EvidenceSource = {
  url: string;
  path: string;
  category?: EvidenceCategory;
  role: "homepage" | "supporting";
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pathFromUrl(value: unknown): string | undefined {
  const url = asString(value);
  if (!url) return undefined;
  try {
    return new URL(url).pathname || "/";
  } catch {
    return undefined;
  }
}

function categoryLabel(value: unknown): string | undefined {
  const category = asString(value);
  if (!category) return undefined;
  return `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
}

export function presentActivityEvent(
  event: ActivityEvent
): InvestigationActivityRow {
  const data = event.data ?? {};
  switch (event.type) {
    case "audit.started":
      return { type: event.type, label: "Investigation started", tone: "active" };
    case "site.homepage_acquired": {
      const path = pathFromUrl(data.url);
      return {
        type: event.type,
        label: "Homepage acquired",
        detail: path && path !== "/" ? path : undefined,
        tone: "complete",
      };
    }
    case "site.pages_discovered": {
      const count = asNumber(data.count) ?? 0;
      return {
        type: event.type,
        label: `${count} relevant page${count === 1 ? "" : "s"} discovered`,
        tone: "complete",
      };
    }
    case "evidence.insufficient": {
      const categories = Array.isArray(data.categories)
        ? data.categories.map(categoryLabel).filter(Boolean).join(" and ")
        : "Additional";
      return {
        type: event.type,
        label: `${categories} evidence needs more context`,
        tone: "warning",
      };
    }
    case "evidence.selected": {
      const path = pathFromUrl(data.url);
      return {
        type: event.type,
        label: `Inspecting ${path && path !== "/" ? path : "selected page"}`,
        detail: categoryLabel(data.category),
        tone: "active",
      };
    }
    case "evidence.acquired": {
      const path = pathFromUrl(data.url);
      return {
        type: event.type,
        label: `${categoryLabel(data.category) ?? "Supporting"} evidence collected`,
        detail: path && path !== "/" ? path : undefined,
        tone: "complete",
      };
    }
    case "evidence.sufficient":
      return {
        type: event.type,
        label: "Evidence coverage sufficient",
        tone: "complete",
      };
    case "startup.identified":
      return {
        type: event.type,
        label: "Startup identified",
        detail: asString(data.company_name),
        tone: "complete",
      };
    case "scoring.started":
      return { type: event.type, label: "Evaluating growth readiness", tone: "active" };
    case "report.persisted":
      return { type: event.type, label: "Report saved", tone: "complete" };
    case "audit.completed":
      return { type: event.type, label: "Investigation complete", tone: "complete" };
    case "audit.failed":
      return { type: event.type, label: "Investigation failed", tone: "failed" };
  }
}

export function presentActivityEvents(
  events: ActivityEvent[]
): InvestigationActivityRow[] {
  return events.map(presentActivityEvent).filter(Boolean) as InvestigationActivityRow[];
}

export function successfulEvidenceSources(
  evidence: EvidencePageSummary[] | undefined
): EvidenceSource[] {
  const seen = new Set<string>();
  return (evidence ?? [])
    .filter((page) => page.status === "acquired" && !seen.has(page.url))
    .map((page) => {
      seen.add(page.url);
      return {
        url: page.url,
        path: page.path,
        role: page.role,
        ...(page.category ? { category: page.category } : {}),
      };
    });
}

export function evidenceSourcesFromEvents(
  events: ActivityEvent[]
): EvidenceSource[] {
  const sources: EvidenceSource[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== "site.homepage_acquired" && event.type !== "evidence.acquired") {
      continue;
    }
    const url = asString(event.data?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      url,
      path: pathFromUrl(url) ?? "/",
      role: event.type === "site.homepage_acquired" ? "homepage" : "supporting",
      ...(event.type === "evidence.acquired" && asString(event.data?.category)
        ? { category: event.data?.category as EvidenceCategory }
        : {}),
    });
  }
  return sources;
}

export function inspectedPageCount(result: AuditSummary): number {
  return result.pagesInspected ?? successfulEvidenceSources(result.evidence).length;
}

export function inspectedPageCountFromEvents(events: ActivityEvent[]): number {
  return evidenceSourcesFromEvents(events).length;
}

export function auditResultEvidenceLabel(result: AuditSummary): string {
  const count = inspectedPageCount(result);
  return `${count} page${count === 1 ? "" : "s"} inspected`;
}

const BUDGET_STOP_REASONS = new Set<EvidenceGatherStopReason>([
  "page_budget",
  "planning_round_budget",
  "character_budget",
  "gather_timeout",
]);

export function conversationalAuditSummary(result: AuditSummary): string {
  const company = result.identity?.company_name || result.company_name || "This startup";
  const count = inspectedPageCount(result);
  const stopReason = result.stopReason ?? result.investigation?.stopReason;
  const opening = stopReason && BUDGET_STOP_REASONS.has(stopReason)
    ? `I inspected the strongest ${count} page${count === 1 ? "" : "s"} available within this investigation.`
    : `I inspected ${count} page${count === 1 ? "" : "s"} for this investigation.`;
  const lines = [opening, `${company} scores ${result.overallScore}/100 on Growth Readiness.`];
  const constraint = result.the_verdict?.primary_constraint;
  if (constraint) lines.push(`The primary bottleneck is ${constraint.replace(/\.$/, "")}.`);
  else if (result.score_interpretation) lines.push(result.score_interpretation);
  lines.push("The full breakdown is in the report.");
  return lines.join(" ");
}

export function discoveredCandidateCount(events: ActivityEvent[]): number {
  for (let index = events.length - 1; index >= 0; index--) {
    if (events[index].type === "site.pages_discovered") {
      return asNumber(events[index].data?.count) ?? 0;
    }
  }
  return 0;
}

export function latestCoverageFromEvents(
  events: ActivityEvent[]
): EvidenceCoverageAssessment | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const coverage = events[index].data?.coverage;
    if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) continue;
    const candidate = coverage as Record<string, unknown>;
    if (
      EVIDENCE_CATEGORIES.every(
        (category) =>
          candidate[category] === "low" ||
          candidate[category] === "medium" ||
          candidate[category] === "high"
      )
    ) {
      return candidate as EvidenceCoverageAssessment;
    }
  }
  return undefined;
}

const STOP_REASON_LABELS: Record<EvidenceGatherStopReason, string> = {
  sufficient: "Evidence coverage reached",
  page_budget: "Page limit reached",
  planning_round_budget: "Planning round limit reached",
  character_budget: "Evidence size limit reached",
  gather_timeout: "Investigation time limit reached",
  discovery_failed: "Page discovery unavailable; homepage audit completed",
  no_candidates: "No additional useful pages found",
  no_selection: "No valid additional page selected",
};

export function stopReasonLabel(reason: EvidenceGatherStopReason | undefined) {
  return reason ? STOP_REASON_LABELS[reason] : undefined;
}
