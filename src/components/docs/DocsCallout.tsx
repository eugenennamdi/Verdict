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
        "border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300",
      iconClass: "text-slate-500 dark:text-slate-400",
      titleClass: "text-slate-900 dark:text-white",
    },
    important: {
      icon: AlertCircle,
      defaultTitle: "Important",
      containerClass:
        "border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300",
      iconClass: "text-orange-500 dark:text-orange-400",
      titleClass: "text-slate-900 dark:text-white",
    },
    security: {
      icon: ShieldCheck,
      defaultTitle: "Security boundary",
      containerClass:
        "border-slate-200/90 bg-white dark:border-slate-800/90 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300",
      iconClass: "text-emerald-600 dark:text-emerald-400",
      titleClass: "text-slate-900 dark:text-white",
    },
    warning: {
      icon: AlertTriangle,
      defaultTitle: "Warning",
      containerClass:
        "border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20 text-slate-700 dark:text-slate-300",
      iconClass: "text-amber-600 dark:text-amber-400",
      titleClass: "text-amber-900 dark:text-amber-200",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <aside
      className={`my-6 flex gap-3.5 rounded-2xl border p-4 sm:p-5 text-[13.5px] leading-relaxed shadow-xs ${config.containerClass}`}
    >
      <Icon className={`size-5 shrink-0 mt-0.5 ${config.iconClass}`} aria-hidden="true" />
      <div className="space-y-1 min-w-0">
        <p className={`font-semibold text-[13.5px] ${config.titleClass}`}>
          {title || config.defaultTitle}
        </p>
        <div className="text-slate-600 dark:text-slate-400 space-y-2 [&_p]:m-0 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          {children}
        </div>
      </div>
    </aside>
  );
}
