import type {
  EvidenceAcquisitionMethod,
  EvidenceCategory,
  EvidencePage,
  EvidenceSignals,
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
  signals?: EvidenceSignals;
};

export function orderedSuccessfulEvidencePages(
  pages: EvidencePage[]
): EvidencePage[] {
  return pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => page.status === "acquired")
    .sort((left, right) => {
      if (left.page.role !== right.page.role) {
        return left.page.role === "homepage" ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map(({ page }) => page);
}

export function assignEvidenceSourceIds(
  pages: EvidencePage[]
): EvidenceSourceReference[] {
  return orderedSuccessfulEvidencePages(pages).map((page, index) => ({
    sourceId: `S${index + 1}`,
    url: page.url,
    path: page.path,
    role: page.role,
    ...(page.category ? { category: page.category } : {}),
    acquisitionMethod: page.acquisitionMethod,
    chars: page.chars,
    ...(page.signals ? { signals: { ...page.signals } } : {}),
  }));
}
