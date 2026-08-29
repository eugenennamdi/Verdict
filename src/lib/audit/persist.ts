import { supabaseAdmin } from "@/lib/supabase";
import type { EvidenceTrace } from "@/lib/audit/evidenceTrace";

export type PersistableAudit = {
  company_name?: string;
  score_interpretation?: string;
  overallScore?: number;
  priority_matrix?: unknown;
  the_verdict?: unknown;
  pillars?: unknown;
};

export async function persistReport(input: {
  url: string;
  company_name: string;
  audit: PersistableAudit;
  evidenceTrace?: EvidenceTrace;
}): Promise<string> {
  const row = buildPersistedReportRow(input);
  const { data, error } = await supabaseAdmin
    .from("reports")
    .insert([row])
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Supabase Error:", error);
    throw new Error("Failed to save report to database");
  }

  return data.id as string;
}

export function buildPersistedReportRow(input: {
  url: string;
  company_name: string;
  audit: PersistableAudit;
  evidenceTrace?: EvidenceTrace;
}) {
  return {
    company_name: input.company_name,
    url: input.url,
    fdi_buzzword_density: 0,
    fdi_trust_deficit: 0,
    fdi_gatekeeping_friction: 0,
    fdi_feature_ratio: 0,
    fdi_overall_score: input.audit.overallScore || 0,
    verdict_value_prop: "N/A",
    verdict_evidence_deficit: "N/A",
    verdict_revenue_viability: "N/A",
    verdict_distribution_moat: "N/A",
    verdict_intent_friction: "N/A",
    verdict_competitive_overlap: "N/A",
    verdict_terminal_risk: "N/A",
    executive_summary: input.audit.score_interpretation || "N/A",
    first_impression_teardown: "N/A",
    top_5_priorities: input.audit.priority_matrix || [],
    key_risks: input.audit.the_verdict || {},
    growth_plan_30_day: input.audit.pillars || {},
    evidence_trace: input.evidenceTrace ?? null,
  };
}
