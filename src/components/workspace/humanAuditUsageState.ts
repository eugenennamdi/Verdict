import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

export type HumanAuditUsageStatus = "loading" | "ready" | "unavailable";

export type HumanAuditUsageViewState = {
  status: HumanAuditUsageStatus;
  usage: HumanAuditUsageState | null;
};

export const INITIAL_HUMAN_AUDIT_USAGE_STATE: HumanAuditUsageViewState = {
  status: "loading",
  usage: null,
};

export const USAGE_FETCH_TIMEOUT_MS = 3_000;

export function readyHumanAuditUsage(
  usage: HumanAuditUsageState
): HumanAuditUsageViewState {
  return { status: "ready", usage };
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function isHumanAuditUsageState(
  value: unknown
): value is HumanAuditUsageState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HumanAuditUsageState>;
  const free = candidate.free;
  const paid = candidate.paid;
  return Boolean(
    free &&
      paid &&
      isNonNegativeInteger(free.limit) &&
      isNonNegativeInteger(free.used) &&
      isNonNegativeInteger(free.remaining) &&
      (free.nextAvailableAt === null ||
        typeof free.nextAvailableAt === "string") &&
      isNonNegativeInteger(paid.available) &&
      typeof candidate.canStartAudit === "boolean"
  );
}

type UsageResponse = Pick<Response, "ok" | "json">;
type UsageFetcher = (signal: AbortSignal) => Promise<UsageResponse>;

export async function loadHumanAuditUsage(
  fetchUsage: UsageFetcher = (signal) =>
    fetch("/api/usage", { method: "GET", signal }),
  timeoutMs = USAGE_FETCH_TIMEOUT_MS
): Promise<HumanAuditUsageViewState> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<HumanAuditUsageViewState>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ status: "unavailable", usage: null });
    }, timeoutMs);
  });

  try {
    const request = (async (): Promise<HumanAuditUsageViewState> => {
      const response = await fetchUsage(controller.signal);
      if (!response.ok) return { status: "unavailable", usage: null };
      const payload: unknown = await response.json();
      return isHumanAuditUsageState(payload)
        ? readyHumanAuditUsage(payload)
        : { status: "unavailable", usage: null };
    })();
    return await Promise.race([request, timeout]);
  } catch {
    return { status: "unavailable", usage: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
