import type { ActivityEvent } from "@/lib/audit/events";
import type {
  EvidenceCoverage,
  EvidenceCoverageAssessment,
  EvidencePageSummary,
} from "@/lib/audit/evidence";
import type { EvidenceBudgetUsage } from "@/lib/audit/evidenceTrace";
import type { EvidenceGatherStopReason } from "@/lib/audit/gather";
import type { PublicAuditQaMetadata } from "@/lib/conversation/auditAnswer";
import type { HumanAuditQuotaState } from "@/lib/humanAuditQuotaContract";

export type PillarScore = {
  score?: number;
  confidence?: string;
  reason?: string;
};

export type AuditSummary = {
  reportId?: string;
  overallScore: number;
  identity: {
    company_name: string;
    inferred_description?: string;
    target_audience?: string;
    primary_cta?: string;
  };
  evidence?: EvidencePageSummary[];
  evidenceCoverage?: EvidenceCoverage;
  finalCoverage?: EvidenceCoverageAssessment;
  pagesInspected?: number;
  budgetUsage?: EvidenceBudgetUsage;
  stopReason?: EvidenceGatherStopReason;
  investigation?: {
    candidatesDiscovered: number;
    planningRounds: number;
    pageAttempts: number;
    stopReason: EvidenceGatherStopReason;
  };
  humanAuditQuota?: HumanAuditQuotaState;
  company_name?: string;
  score_interpretation?: string;
  the_verdict?: {
    status?: string;
    primary_constraint?: string;
    highest_opportunity?: string;
    estimated_impact?: string;
  };
  priority_matrix?: { task?: string; impact?: string; effort?: string; why?: string }[];
  pillars?: Record<string, PillarScore>;
};

export type RecentInvestigation = {
  id: string;
  url: string;
  domain: string;
  companyName: string;
  score: number;
  reportId?: string;
  timestamp: number;
  result?: AuditSummary;
  summary?: string;
  messages?: WorkspaceMessage[];
};

export type WorkspaceMessage =
  | { id: string; role: "user"; kind: "text"; content: string }
  | {
      id: string;
      role: "verdict";
      kind: "text";
      content: string;
      auditQa?: PublicAuditQaMetadata;
    }
  | { id: string; role: "verdict"; kind: "trace"; events: ActivityEvent[]; domain?: string }
  | { id: string; role: "verdict"; kind: "result"; summary: string; result: AuditSummary; domain?: string }
  | { id: string; role: "verdict"; kind: "error"; message: string; domain?: string };

export type WorkspacePhase = "idle" | "investigating" | "complete";
