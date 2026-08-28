import { createTracer, type ActivityEvent, type EventEmitter } from "@/lib/audit/events";
import { persistReport } from "@/lib/audit/persist";
import {
  fetchContext,
  gradeFromMarkdown,
  identifyFromMarkdown,
} from "@/lib/engine";
import { assertSafeAuditUrl } from "@/lib/security/url";

export type AuditBudget = {
  maxAdditionalPages: number;
};

export type VerdictIdentity = {
  company_name: string;
  inferred_description: string;
  target_audience: string;
  primary_cta: string;
};

export type HomepageEvidence = {
  url: string;
  category: "homepage";
  chars: number;
};

export type RunVerdictAuditInput = {
  url: string;
  fallbackText?: string;
  persist?: boolean;
  onEvent?: EventEmitter;
  budget?: Partial<AuditBudget>;
};

export type RunVerdictAuditResult = {
  reportId?: string;
  audit: Awaited<ReturnType<typeof gradeFromMarkdown>>;
  overallScore: number;
  identity: VerdictIdentity;
  trace: ActivityEvent[];
  evidence: HomepageEvidence[];
};

export async function runVerdictAudit(
  input: RunVerdictAuditInput
): Promise<RunVerdictAuditResult> {
  const tracer = createTracer(input.onEvent);
  const persist = input.persist !== false;
  void input.budget;

  try {
    const parsed = await assertSafeAuditUrl(input.url);
    tracer.emit("audit.started", undefined, { url: parsed.href });

    const markdown = await fetchContext(parsed.href, input.fallbackText);
    tracer.emit("site.homepage_acquired", undefined, {
      url: parsed.href,
      chars: markdown.length,
    });

    const extracted = await identifyFromMarkdown(markdown);
    const identity: VerdictIdentity = {
      company_name: extracted.company_name || "Unknown",
      inferred_description: extracted.inferred_description || "",
      target_audience: extracted.target_audience || "",
      primary_cta: extracted.primary_cta || "",
    };
    tracer.emit("startup.identified", undefined, {
      company_name: identity.company_name,
    });

    tracer.emit("scoring.started");
    const audit = await gradeFromMarkdown(parsed.href, markdown);
    const overallScore = audit.overallScore;

    let reportId: string | undefined;
    if (persist) {
      reportId = await persistReport({
        url: parsed.href,
        company_name: identity.company_name || audit.company_name || "Unknown",
        audit,
      });
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
      evidence: [
        {
          url: parsed.href,
          category: "homepage",
          chars: markdown.length,
        },
      ],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    tracer.emit("audit.failed", undefined, { error: message });
    throw error;
  }
}
