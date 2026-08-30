export const HUMAN_AUDIT_QUOTA_LIMIT = 3;
export const HUMAN_AUDIT_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type HumanAuditQuotaState = {
  limit: number;
  used: number;
  remaining: number;
  nextAvailableAt: string | null;
};

function remainingDuration(nextAvailableAt: string, nowMs: number): string {
  const remainingMs = Math.max(0, Date.parse(nextAvailableAt) - nowMs);
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function humanAuditQuotaLabel(
  quota: HumanAuditQuotaState,
  nowMs = Date.now()
): string {
  if (quota.remaining === quota.limit) {
    return `${quota.limit} free audits available`;
  }
  if (quota.remaining > 0) {
    return `${quota.remaining} free audit${quota.remaining === 1 ? "" : "s"} remaining`;
  }
  if (quota.nextAvailableAt) {
    return `Free audits used for now · Next free audit in ${remainingDuration(
      quota.nextAvailableAt,
      nowMs
    )}`;
  }
  return "Free audits used for now";
}

export function humanAuditQuotaExhaustedMessage(
  quota: HumanAuditQuotaState,
  nowMs = Date.now()
): string {
  if (quota.nextAvailableAt) {
    return `Free audits used for now. Your next free audit becomes available in ${remainingDuration(
      quota.nextAvailableAt,
      nowMs
    )}.`;
  }
  return "Free audits used for now. Please try again later.";
}
