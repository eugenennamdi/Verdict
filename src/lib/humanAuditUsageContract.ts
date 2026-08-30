import type { HumanAuditQuotaState } from "@/lib/humanAuditQuotaContract";

export type HumanPaidAuditUsage = {
  available: number;
};

export type HumanAuditUsageState = {
  free: HumanAuditQuotaState;
  paid: HumanPaidAuditUsage;
  canStartAudit: boolean;
};

export function humanAuditAccessLabel(
  usage: HumanAuditUsageState,
  freeLabel: string
): string {
  if (usage.free.remaining > 0) return freeLabel;
  if (usage.paid.available > 0) {
    return `${usage.paid.available} paid audit${usage.paid.available === 1 ? "" : "s"} ready`;
  }
  return freeLabel;
}
