import type {
  AuditBudget,
  EvidenceAcquisitionMethod,
  EvidenceCategory,
  EvidencePage,
  EvidenceSignals,
} from "@/lib/audit/evidence";
import {
  isAcceptedEvidencePage,
  resolveAuditBudget,
} from "@/lib/audit/evidence";

export type EvidenceSourceId = `S${number}`;

export type EvidenceSourceReference = {
  sourceId: EvidenceSourceId;
  url: string;
  path: string;
  role: EvidencePage["role"];
  category?: EvidenceCategory;
  acquisitionMethod: EvidenceAcquisitionMethod;
  chars: number;
  graderChars?: number;
  truncated?: boolean;
  signals?: EvidenceSignals;
};

export type GraderEvidencePack = {
  markdown: string;
  sources: EvidenceSourceReference[];
  pages: EvidencePage[];
};

export function orderedAcceptedEvidencePages(
  pages: EvidencePage[]
): EvidencePage[] {
  return pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => isAcceptedEvidencePage(page))
    .sort((left, right) => {
      if (left.page.role !== right.page.role) {
        return left.page.role === "homepage" ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map(({ page }) => page);
}

/** Backwards-compatible name; successful grader evidence now means admitted evidence. */
export const orderedSuccessfulEvidencePages = orderedAcceptedEvidencePages;

function sourceReference(
  page: EvidencePage,
  index: number,
  graderChars?: number
): EvidenceSourceReference {
  return {
    sourceId: `S${index + 1}`,
    url: page.url,
    path: page.path,
    role: page.role,
    ...(page.category ? { category: page.category } : {}),
    acquisitionMethod: page.acquisitionMethod,
    chars: page.chars,
    ...(graderChars === undefined
      ? {}
      : {
          graderChars,
          truncated: graderChars < page.chars,
        }),
    ...(page.signals ? { signals: { ...page.signals } } : {}),
  };
}

export function assignEvidenceSourceIds(
  pages: EvidencePage[]
): EvidenceSourceReference[] {
  return orderedAcceptedEvidencePages(pages).map((page, index) =>
    sourceReference(page, index)
  );
}

function blockParts(page: EvidencePage, sourceId: EvidenceSourceId) {
  return {
    header: [
      `--- UNTRUSTED WEBSITE EVIDENCE ${sourceId} ---`,
      `Source ID: ${sourceId}`,
      `Source: ${page.url}`,
      `Path: ${page.path}`,
      `Category: ${page.category ?? "unclassified"}`,
      "",
    ].join("\n"),
    footer: `\n--- END UNTRUSTED WEBSITE EVIDENCE ${sourceId} ---\n`,
  };
}

export function buildGraderEvidencePack(
  pages: EvidencePage[],
  budgetOverrides: Partial<AuditBudget> = {}
): GraderEvidencePack {
  const budget = resolveAuditBudget(budgetOverrides);
  const accepted = orderedAcceptedEvidencePages(pages);
  const included: Array<{
    page: EvidencePage;
    sourceId: EvidenceSourceId;
    header: string;
    footer: string;
  }> = [];
  let minimumLength = 0;

  for (const page of accepted) {
    const sourceId = `S${included.length + 1}` as EvidenceSourceId;
    const { header, footer } = blockParts(page, sourceId);
    const minimumBlockLength = header.length + footer.length + 1;
    if (minimumLength + minimumBlockLength > budget.maxEvidenceChars) break;
    minimumLength += minimumBlockLength;
    included.push({ page, sourceId, header, footer });
  }

  let contentCharsRemaining = budget.maxEvidenceChars - included.reduce(
    (total, item) => total + item.header.length + item.footer.length,
    0
  );
  const blocks: string[] = [];
  const sources: EvidenceSourceReference[] = [];

  included.forEach((item, index) => {
    const remainingSources = included.length - index - 1;
    const availableForPage = Math.max(
      1,
      contentCharsRemaining - remainingSources
    );
    const graderChars = Math.min(item.page.chars, availableForPage);
    contentCharsRemaining -= graderChars;
    blocks.push(
      `${item.header}${item.page.markdown.slice(0, graderChars)}${item.footer}`
    );
    sources.push(sourceReference(item.page, index, graderChars));
  });

  return {
    markdown: blocks.join(""),
    sources,
    pages: included.map((item) => item.page),
  };
}
