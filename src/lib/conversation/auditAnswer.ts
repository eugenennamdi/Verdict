import type { EvidenceCategory } from "@/lib/audit/evidence";
import type { EvidenceSourceId } from "@/lib/audit/source";
import type { AuditModelExecutionMetadata } from "@/lib/audit/model";

export type AuditAnswerType =
  | "evidence"
  | "score_explanation"
  | "framework"
  | "recommendation"
  | "completeness"
  | "counterfactual"
  | "research_extension"
  | "comparison_required"
  | "general";

export type AuditAnswerConfidence = "high" | "medium" | "low";

export type AuditQaAnswer = {
  answer: string;
  citations: EvidenceSourceId[];
  answerType: AuditAnswerType;
  confidence: AuditAnswerConfidence;
  limitations: string[];
  modelProvenance?: AuditModelExecutionMetadata;
};

export type AuditAnswerSource = {
  sourceId: EvidenceSourceId;
  url: string;
  path: string;
  role?: "homepage" | "supporting";
  category?: EvidenceCategory;
};

export type PublicAuditQaMetadata = {
  answerType: AuditAnswerType;
  confidence: AuditAnswerConfidence;
  citations: AuditAnswerSource[];
  limitations: string[];
};
