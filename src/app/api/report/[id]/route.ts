import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { projectCanonicalReportFacts } from "@/lib/audit/canonicalReport";
import { projectPublicPillars } from "@/lib/audit/publicResult";
import {
  loadAuditContext,
  type LoadedAuditContext,
} from "@/lib/conversation/auditContextLoader";
import { supabase } from "@/lib/supabase";

type ReportRow = Record<string, unknown>;

type ReportLookup = (
  reportId: string
) => Promise<{ data: ReportRow | null; error?: unknown }>;

type ReportRouteDependencies = {
  lookup?: ReportLookup;
  loadContext?: (reportId: string) => Promise<LoadedAuditContext | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function projectHumanReport(row: ReportRow): ReportRow {
  return {
    id: row.id,
    company_name: row.company_name,
    url: row.url,
    fdi_overall_score: row.fdi_overall_score,
    executive_summary: row.executive_summary,
    key_risks: row.key_risks,
    top_5_priorities: row.top_5_priorities,
    created_at: row.created_at,
    growth_plan_30_day: projectPublicPillars(
      isRecord(row.growth_plan_30_day) ? row.growth_plan_30_day : undefined
    ),
  };
}

async function defaultLookup(reportId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, company_name, url, fdi_overall_score, executive_summary, key_risks, top_5_priorities, growth_plan_30_day, created_at"
    )
    .eq("id", reportId)
    .single();
  return { data: data as ReportRow | null, error };
}

export function createReportHandler(
  dependencies: ReportRouteDependencies = {}
) {
  const lookup = dependencies.lookup ?? defaultLookup;
  const loadContext = dependencies.loadContext ?? loadAuditContext;

  return async function handleReport(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const id = (await params).id;

      if (!id) {
        return NextResponse.json(
          { error: "Report ID is required" },
          { status: 400 }
        );
      }

      const canonicalOnly =
        new URL(req.url).searchParams.get("view") === "canonical";

      if (canonicalOnly) {
        const loaded = await loadContext(id);
        if (!loaded) {
          return NextResponse.json(
            { error: "Report not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          reportId: id,
          canonicalReportFacts: projectCanonicalReportFacts(loaded.context),
        });
      }

      const { data, error } = await lookup(id);
      if (error || !data) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }

      let loaded: LoadedAuditContext | null = null;
      try {
        loaded = await loadContext(id);
      } catch {
        // Keep the existing report readable if canonical hydration is
        // temporarily unavailable; the persisted row remains authoritative.
      }

      return NextResponse.json({
        ...projectHumanReport(data),
        canonicalReportFacts: projectCanonicalReportFacts(
          loaded?.context ?? data
        ),
      });
    } catch (error: unknown) {
      console.error("Fetch Report Error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  };
}

export const GET = createReportHandler();
