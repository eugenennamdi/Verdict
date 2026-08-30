import {
  consumeHumanAuditEntitlement,
  getAvailableHumanAuditEntitlements,
  releaseHumanAuditEntitlement,
  reserveHumanAuditEntitlement,
  type HumanPaidAuditReservation,
} from "@/lib/humanAuditEntitlement";
import {
  canStartHumanAudit,
  getHumanAuditQuota,
  recordSuccessfulHumanAudit,
  releaseHumanAuditReservation,
} from "@/lib/humanAuditQuota";
import {
  HUMAN_AUDIT_QUOTA_LIMIT,
  type HumanAuditQuotaState,
} from "@/lib/humanAuditQuotaContract";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

export type HumanAuditReservedAccess =
  | {
      accessType: "free";
      reservationToken: string;
    }
  | {
      accessType: "paid";
      entitlement: HumanPaidAuditReservation;
    };

export type HumanAuditAccessDecision =
  | {
      allowed: true;
      access: HumanAuditReservedAccess;
      usage: HumanAuditUsageState;
    }
  | {
      allowed: false;
      reason: "payment_required";
      usage: HumanAuditUsageState;
    };

type AccessDependencies = {
  reserveFree?: typeof canStartHumanAudit;
  getFree?: typeof getHumanAuditQuota;
  commitFree?: typeof recordSuccessfulHumanAudit;
  releaseFree?: typeof releaseHumanAuditReservation;
  getPaid?: typeof getAvailableHumanAuditEntitlements;
  reservePaid?: typeof reserveHumanAuditEntitlement;
  consumePaid?: typeof consumeHumanAuditEntitlement;
  releasePaid?: typeof releaseHumanAuditEntitlement;
};

function usageState(
  free: HumanAuditQuotaState,
  paidAvailable: number
): HumanAuditUsageState {
  return {
    free,
    paid: { available: paidAvailable },
    canStartAudit: free.remaining > 0 || paidAvailable > 0,
  };
}

async function safePaidAvailable(
  visitorHash: string,
  dependencies: AccessDependencies
): Promise<number> {
  try {
    return await (
      dependencies.getPaid ?? getAvailableHumanAuditEntitlements
    )(visitorHash);
  } catch {
    return 0;
  }
}

export async function getHumanAuditUsage(
  visitorHash: string,
  dependencies: AccessDependencies = {}
): Promise<HumanAuditUsageState> {
  const free = await (dependencies.getFree ?? getHumanAuditQuota)(visitorHash);
  const paidAvailable = await safePaidAvailable(visitorHash, dependencies);
  return usageState(free, paidAvailable);
}

export async function reserveHumanAuditAccess(
  visitorHash: string,
  dependencies: AccessDependencies = {}
): Promise<HumanAuditAccessDecision> {
  const free = await (dependencies.reserveFree ?? canStartHumanAudit)(visitorHash);
  if (free.allowed) {
    const paidAvailable = await safePaidAvailable(visitorHash, dependencies);
    return {
      allowed: true,
      access: {
        accessType: "free",
        reservationToken: free.reservationToken,
      },
      usage: usageState(free.quota, paidAvailable),
    };
  }

  const paid = await (
    dependencies.reservePaid ?? reserveHumanAuditEntitlement
  )(visitorHash);
  if (!paid) {
    return {
      allowed: false,
      reason: "payment_required",
      usage: usageState(free.quota, 0),
    };
  }
  const paidAvailable = await safePaidAvailable(visitorHash, dependencies);
  return {
    allowed: true,
    access: { accessType: "paid", entitlement: paid },
    usage: usageState(free.quota, paidAvailable),
  };
}

export async function completeHumanAuditAccess(
  visitorHash: string,
  access: HumanAuditReservedAccess,
  reportId: string | undefined,
  dependencies: AccessDependencies = {}
): Promise<HumanAuditUsageState> {
  if (access.accessType === "free") {
    const free = await (
      dependencies.commitFree ?? recordSuccessfulHumanAudit
    )(visitorHash, access.reservationToken, reportId);
    const paidAvailable = await safePaidAvailable(visitorHash, dependencies);
    return usageState(free, paidAvailable);
  }

  await (dependencies.consumePaid ?? consumeHumanAuditEntitlement)(
    visitorHash,
    access.entitlement,
    reportId
  );
  const [freeResult, paidResult] = await Promise.allSettled([
    (dependencies.getFree ?? getHumanAuditQuota)(visitorHash),
    (dependencies.getPaid ?? getAvailableHumanAuditEntitlements)(visitorHash),
  ]);
  const free =
    freeResult.status === "fulfilled"
      ? freeResult.value
      : {
          limit: HUMAN_AUDIT_QUOTA_LIMIT,
          used: HUMAN_AUDIT_QUOTA_LIMIT,
          remaining: 0,
          nextAvailableAt: null,
        };
  const paidAvailable =
    paidResult.status === "fulfilled" ? paidResult.value : 0;
  return usageState(free, paidAvailable);
}

export async function releaseHumanAuditAccess(
  visitorHash: string,
  access: HumanAuditReservedAccess,
  dependencies: AccessDependencies = {}
): Promise<void> {
  if (access.accessType === "free") {
    await (dependencies.releaseFree ?? releaseHumanAuditReservation)(
      visitorHash,
      access.reservationToken
    );
    return;
  }
  await (dependencies.releasePaid ?? releaseHumanAuditEntitlement)(
    visitorHash,
    access.entitlement
  );
}
