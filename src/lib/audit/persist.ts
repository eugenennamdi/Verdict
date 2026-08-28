import { supabaseAdmin } from "@/lib/supabase";

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
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .insert([
      {
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
      },
    ])
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Supabase Error:", error);
    throw new Error("Failed to save report to database");
  }

  return data.id as string;
}
