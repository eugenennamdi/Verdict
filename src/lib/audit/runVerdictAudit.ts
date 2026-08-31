import { createTracer, type ActivityEvent, type EventEmitter } from "@/lib/audit/events";
import { acquireEvidencePage } from "@/lib/audit/acquire";
import {
  resolveAuditBudget,
  summarizeEvidenceCoverage,
  summarizeEvidencePage,
  type AuditBudget,
  type EvidenceCoverage,
  type EvidenceCoverageAssessment,
  type EvidencePageSummary,
} from "@/lib/audit/evidence";
import {
  serializeEvidenceTrace,
  type EvidenceBudgetUsage,
  type EvidenceTrace,
} from "@/lib/audit/evidenceTrace";
import {
  gatherAuditEvidence,
  type EvidenceGatherStopReason,
} from "@/lib/audit/gather";
import {
  buildAuditContextPack,
  type AuditContextPackV1,
} from "@/lib/audit/auditContext";
import { persistReport } from "@/lib/audit/persist";
import { buildGraderEvidencePack } from "@/lib/audit/source";
import {
  gradeFromMarkdown,
  identifyFromMarkdown,
  ScrapingError,
} from "@/lib/engine";
import { assertSafeAuditUrl } from "@/lib/security/url";
import type {
  AuditModelObserver,
  AuditRunModelProvenance,
} from "@/lib/audit/model";
import { ModelAvailabilityError } from "@/lib/audit/model";
import {
  isSanitizedModelAvailabilityError,
  MODEL_TEMPORARILY_UNAVAILABLE_CODE,
} from "@/lib/audit/publicError";

export type { AuditBudget } from "@/lib/audit/evidence";

export const DEFAULT_AUDIT_DEADLINE_MS = 200_000;
export const AUDIT_FINALIZATION_HEADROOM_MS = 20_000;
const MIN_FINAL_GRADER_START_WINDOW_MS = 5_000;

export type VerdictIdentity = {
  company_name: string;
  inferred_description: string;
  target_audience: string;
  primary_cta: string;
};

export type RunVerdictAuditInput = {
  url: string;
  fallbackText?: string;
  persist?: boolean;
  onEvent?: EventEmitter;
  budget?: Partial<AuditBudget>;
  /** Internal upper bound; callers may shorten but never widen the default. */
  deadlineAt?: number;
};

export type RunVerdictAuditResult = {
  reportId?: string;
  audit: Awaited<ReturnType<typeof gradeFromMarkdown>>;
  overallScore: number;
  identity: VerdictIdentity;
  trace: ActivityEvent[];
  evidence: EvidencePageSummary[];
  evidenceCoverage: EvidenceCoverage;
  finalCoverage: EvidenceCoverageAssessment;
  pagesInspected: number;
  pagesAccepted: number;
  budgetUsage: EvidenceBudgetUsage;
  stopReason: EvidenceGatherStopReason;
  evidenceTrace: EvidenceTrace;
  auditContext: AuditContextPackV1;
  modelProvenance: AuditRunModelProvenance;
  investigation: {
    candidatesDiscovered: number;
    candidatesRetained: number;
    planningRounds: number;
    pageAttempts: number;
    stopReason: EvidenceGatherStopReason;
  };
};

export async function runVerdictAudit(
  input: RunVerdictAuditInput
): Promise<RunVerdictAuditResult> {
  const runStartedAt = Date.now();
  const defaultDeadlineAt = runStartedAt + DEFAULT_AUDIT_DEADLINE_MS;
  const auditDeadlineAt = Math.min(
    input.deadlineAt ?? defaultDeadlineAt,
    defaultDeadlineAt
  );
  const modelDeadlineAt = auditDeadlineAt - AUDIT_FINALIZATION_HEADROOM_MS;
  const tracer = createTracer(input.onEvent);
  const persist = input.persist !== false;
  const budget = resolveAuditBudget(input.budget);
  const modelProvenance: AuditRunModelProvenance = {
    planner: [],
    admission: [],
  };
  const onModelResult: AuditModelObserver = (task, metadata) => {
    if (task === "planner") {
      modelProvenance.planner.push({ ...metadata });
    } else if (task === "admission") {
      modelProvenance.admission?.push({ ...metadata });
    } else if (task === "normalization") {
      modelProvenance.normalization = { ...metadata };
    } else if (task === "grader") {
      modelProvenance.grader = { ...metadata };
    }
  };

  try {
    const parsed = await assertSafeAuditUrl(input.url);
    if (Date.now() >= modelDeadlineAt) {
      throw new ModelAvailabilityError("timeout");
    }
    tracer.emit("audit.started", undefined, { url: parsed.href });
    const gatherStartedAt = Date.now();
    const gatherDeadlineAt = Math.min(
      gatherStartedAt + budget.gatherTimeoutMs,
      modelDeadlineAt
    );

    const homepage = await acquireEvidencePage({
      url: parsed.href,
      role: "homepage",
      category: "identity",
      fallbackText: input.fallbackText,
      budget,
    });
    if (homepage.status !== "acquired") {
      throw new ScrapingError(
        homepage.error ||
          "This website took too long to load or is actively blocking our scraper. Please provide the raw website text manually."
      );
    }

    const markdown = homepage.markdown;
    tracer.emit("site.homepage_acquired", undefined, {
      url: homepage.url,
      chars: homepage.chars,
    });

    const extracted = await identifyFromMarkdown(markdown, {
      deadlineAt: gatherDeadlineAt,
      onModelResult,
    });
    const identity: VerdictIdentity = {
      company_name: extracted.company_name || "Unknown",
      inferred_description: extracted.inferred_description || "",
      target_audience: extracted.target_audience || "",
      primary_cta: extracted.primary_cta || "",
    };
    tracer.emit("startup.identified", undefined, {
      company_name: identity.company_name,
    });

    const gathered = await gatherAuditEvidence({
      rootUrl: parsed.href,
      identity,
      homepage,
      budget,
      startedAt: gatherStartedAt,
      tracer,
      onModelResult,
    });
    const graderPack = buildGraderEvidencePack(gathered.pages, budget);
    const sources = graderPack.sources;
    const graderEvidence = graderPack.markdown;

    tracer.emit("scoring.started");
    if (
      modelDeadlineAt - Date.now() <
      MIN_FINAL_GRADER_START_WINDOW_MS
    ) {
      throw new ModelAvailabilityError("timeout");
    }
    const audit = await gradeFromMarkdown(parsed.href, graderEvidence, {
      sources,
      deadlineAt: modelDeadlineAt,
      onModelResult,
    });
    if (Date.now() >= auditDeadlineAt) {
      throw new ModelAvailabilityError("timeout");
    }
    const overallScore = audit.overallScore;
    const evidenceTrace = serializeEvidenceTrace({
      pages: gathered.pages,
      coverage: gathered.coverage,
      planningRounds: gathered.planningRounds,
      pageAttempts: gathered.pageAttempts,
      budget,
      stopReason: gathered.stopReason,
      graderSources: sources,
    });
    let auditContext = buildAuditContextPack({
      url: parsed.href,
      auditTimestamp: new Date().toISOString(),
      identity,
      audit,
      overallScore,
      sources,
      evidenceDigests: audit.evidenceDigests,
      finalCoverage: gathered.coverage,
      planningRounds: gathered.planningRounds,
      stopReason: gathered.stopReason,
      budgetUsage: evidenceTrace.budget,
      models: modelProvenance,
    });

    let reportId: string | undefined;
    if (persist) {
      if (Date.now() >= auditDeadlineAt) {
        throw new ModelAvailabilityError("timeout");
      }
      reportId = await persistReport({
        url: parsed.href,
        company_name: identity.company_name || audit.company_name || "Unknown",
        audit,
        evidenceTrace,
        auditContext,
      });
      auditContext = { ...auditContext, reportId };
      tracer.emit("report.persisted", undefined, { report_id: reportId });
    }

    tracer.emit("audit.completed", undefined, {
      report_id: reportId,
      score: overallScore,
    });

    return {
      reportId,
      audit,
      overallScore,
      identity,
      trace: tracer.events,
      evidence: gathered.pages
        .filter(
          (page) => page.admission?.status !== "rejected_irrelevant"
        )
        .map(summarizeEvidencePage),
      evidenceCoverage: summarizeEvidenceCoverage(gathered.pages),
      finalCoverage: gathered.coverage,
      pagesInspected: evidenceTrace.budget.pagesInspected,
      pagesAccepted:
        evidenceTrace.budget.pagesAccepted ?? evidenceTrace.pages.length,
      budgetUsage: evidenceTrace.budget,
      stopReason: gathered.stopReason,
      evidenceTrace,
      auditContext,
      modelProvenance,
      investigation: {
        candidatesDiscovered: gathered.candidatesDiscovered,
        candidatesRetained: gathered.candidatesRetained,
        planningRounds: gathered.planningRounds,
        pageAttempts: gathered.pageAttempts,
        stopReason: gathered.stopReason,
      },
    };
  } catch (error: unknown) {
    const safeError =
      isSanitizedModelAvailabilityError(error)
        ? MODEL_TEMPORARILY_UNAVAILABLE_CODE
        : error instanceof ScrapingError
          ? "SCRAPING_FAILED"
          : "AUDIT_FAILED";
    tracer.emit("audit.failed", undefined, { error: safeError });
    throw error;
  }
}
