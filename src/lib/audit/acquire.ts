import {
  fetchContextDetailed,
  type ContextAcquisitionResult,
} from "@/lib/engine";
import {
  assertSafeAuditUrl,
  type LookupFn,
} from "@/lib/security/url";
import {
  canAcquireEvidence,
  createEvidencePage,
  limitEvidenceMarkdown,
  remainingEvidenceChars,
  resolveAuditBudget,
  type AuditBudget,
  type EvidenceCategory,
  type EvidencePage,
} from "@/lib/audit/evidence";

export type ContextFetcher = (
  url: string,
  fallbackText?: string,
  options?: { maxChars?: number; timeoutMs?: number }
) => Promise<ContextAcquisitionResult>;

export type AcquireEvidencePageInput = {
  url: string;
  role?: EvidencePage["role"];
  category?: EvidenceCategory;
  fallbackText?: string;
  budget?: Partial<AuditBudget>;
  pagesUsed?: number;
  evidenceCharsUsed?: number;
  lookup?: LookupFn;
  contextFetcher?: ContextFetcher;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Acquire exactly one selected page. This primitive never discovers or follows links.
 */
export async function acquireEvidencePage(
  input: AcquireEvidencePageInput
): Promise<EvidencePage> {
  const budget = resolveAuditBudget(input.budget);
  const pagesUsed = Math.max(0, input.pagesUsed ?? 0);
  const charsUsed = Math.max(0, input.evidenceCharsUsed ?? 0);
  const role = input.role ?? "supporting";

  if (!canAcquireEvidence(budget, pagesUsed, charsUsed)) {
    return createEvidencePage({
      url: input.url,
      role,
      category: input.category,
      status: "skipped",
      error: "Audit evidence budget exhausted",
    });
  }

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeAuditUrl(input.url, { lookup: input.lookup });
  } catch (error) {
    return createEvidencePage({
      url: input.url,
      role,
      category: input.category,
      status: "failed",
      error: errorMessage(error),
    });
  }

  try {
    const remainingChars = remainingEvidenceChars(budget, charsUsed);
    const result = await (input.contextFetcher ?? fetchContextDetailed)(
      safeUrl.href,
      input.fallbackText,
      {
        maxChars: remainingChars,
        timeoutMs: budget.gatherTimeoutMs,
      }
    );
    const markdown = limitEvidenceMarkdown(result.markdown, budget, charsUsed);

    return createEvidencePage({
      url: safeUrl.href,
      role,
      category: input.category,
      acquisitionMethod: result.method,
      markdown,
      status: "acquired",
    });
  } catch (error) {
    return createEvidencePage({
      url: safeUrl.href,
      role,
      category: input.category,
      status: "failed",
      error: errorMessage(error),
    });
  }
}
