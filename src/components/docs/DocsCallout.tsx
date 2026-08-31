import { ReactNode } from "react";
import { Info, AlertTriangle, ShieldCheck, AlertCircle } from "lucide-react";

interface DocsCalloutProps {
  type?: "note" | "important" | "security" | "warning";
  title?: string;
  children: ReactNode;
}

export function DocsCallout({
  type = "note",
  title,
  children,
}: DocsCalloutProps) {
  const configs = {
    note: {
      icon: Info,
      defaultTitle: "Note",
      containerClass:
        "border-slate-200/80 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300",
      iconClass: "text-slate-500 dark:text-slate-400",
      titleClass: "text-slate-900 dark:text-white",
    },
    important: {
      icon: AlertCircle,
      defaultTitle: "Important",
      containerClass:
        "border-orange-200/70 bg-orange-50/30 dark:border-orange-950/50 dark:bg-orange-950/20 text-slate-700 dark:text-slate-300",
      iconClass: "text-orange-500 dark:text-orange-400",
      titleClass: "text-slate-900 dark:text-white",
    },
    security: {
      icon: ShieldCheck,
      defaultTitle: "Security boundary",
      containerClass:
        "border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-950/50 dark:bg-emerald-950/20 text-slate-700 dark:text-slate-300",
      iconClass: "text-emerald-600 dark:text-emerald-400",
      titleClass: "text-slate-900 dark:text-white",
    },
    warning: {
      icon: AlertTriangle,
      defaultTitle: "Warning",
      containerClass:
        "border-amber-200/70 bg-amber-50/40 dark:border-amber-950/50 dark:bg-amber-950/20 text-slate-700 dark:text-slate-300",
      iconClass: "text-amber-600 dark:text-amber-400",
      titleClass: "text-amber-900 dark:text-amber-200",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <aside
      className={`my-5 flex gap-3.5 rounded-xl border p-4 sm:p-4.5 text-[13px] leading-relaxed shadow-2xs ${config.containerClass}`}
    >
      <Icon className={`size-4.5 shrink-0 mt-0.5 ${config.iconClass}`} aria-hidden="true" />
      <div className="space-y-1 min-w-0">
        <p className={`font-semibold text-[13px] ${config.titleClass}`}>
          {title || config.defaultTitle}
        </p>
        <div className="text-slate-600 dark:text-slate-400 space-y-2 [&_p]:m-0 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          {children}
        </div>
      </div>
    </aside>
  );
}
