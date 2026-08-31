"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { ReportView, type ReportData } from "./ReportView";

export default function ReportPage() {
  const params = useParams();
  const id = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/report/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setReport(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 font-sans">
        <Loader2 className="size-6 animate-spin text-orange-500 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-mono text-[12.5px]">
          Loading report...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 max-w-sm text-center space-y-4 shadow-sm">
          <AlertCircle className="size-8 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Audit not found
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              {error || "This report does not exist or has been deleted."}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors active:scale-[0.98]"
          >
            <ArrowLeft className="size-3.5" /> Back to audit
          </Link>
        </div>
      </div>
    );
  }

  return <ReportView report={report} />;
}
