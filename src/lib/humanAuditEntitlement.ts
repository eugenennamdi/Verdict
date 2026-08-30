import { createHash, randomUUID } from "node:crypto";
import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import { redis } from "@/lib/redis";

export const HUMAN_PAID_AUDIT_RESERVATION_TTL_MS = 10 * 60 * 1_000;
export const HUMAN_PAID_AUDIT_CONSUMED_RETENTION_MS =
  180 * 24 * 60 * 60 * 1_000;
// Available purchases intentionally do not expire. Consumed metadata is retained
// for 180 days, while the compact settlement tombstone remains to prevent replay.

export type HumanPaidAuditEntitlementStatus =
  | "available"
  | "reserved"
  | "consumed";

export type HumanPaidAuditEntitlementRecord = {
  id: string;
  visitorHash: string;
  status: HumanPaidAuditEntitlementStatus;
  settlementReference: string;
  transaction: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  payer?: string;
  createdAt: number;
  reservationToken?: string;
  reservationExpiresAt?: number;
  consumedAt?: number;
  reportId?: string;
};

export type HumanPaidAuditReservation = {
  entitlementId: string;
  reservationToken: string;
};

type CreateResult = {
  entitlementId: string;
  created: boolean;
};

export interface HumanAuditEntitlementStore {
  create(record: HumanPaidAuditEntitlementRecord): Promise<CreateResult>;
  availableCount(visitorHash: string, nowMs: number): Promise<number>;
  reserve(input: {
    visitorHash: string;
    reservationToken: string;
    nowMs: number;
    expiresAt: number;
  }): Promise<HumanPaidAuditReservation | null>;
  consume(input: {
    visitorHash: string;
    entitlementId: string;
    reservationToken: string;
    reportId: string;
    nowMs: number;
  }): Promise<boolean>;
  release(input: {
    visitorHash: string;
    entitlementId: string;
    reservationToken: string;
    nowMs: number;
  }): Promise<boolean>;
}

const SLOT = "{human-audit-entitlements}";
const SETTLEMENTS_KEY = `human_audit_entitlement:${SLOT}:settlements`;
const RECORDS_KEY = `human_audit_entitlement:${SLOT}:records`;

function consumedRecordKey(entitlementId: string): string {
  return `human_audit_entitlement:${SLOT}:consumed:${entitlementId}`;
}

function availableKey(visitorHash: string): string {
  return `human_audit_entitlement:${SLOT}:visitor:${visitorHash}:available`;
}

function reservedKey(visitorHash: string): string {
  return `human_audit_entitlement:${SLOT}:visitor:${visitorHash}:reserved`;
}

const CREATE_SCRIPT = `
local settlementKey = KEYS[1]
local recordsKey = KEYS[2]
local availableKey = KEYS[3]
local settlementReference = ARGV[1]
local entitlementId = ARGV[2]
local recordJson = ARGV[3]
local createdAt = tonumber(ARGV[4])
local existing = redis.call('HGET', settlementKey, settlementReference)
if existing then
  return {0, existing}
end
redis.call('HSET', settlementKey, settlementReference, entitlementId)
redis.call('HSET', recordsKey, entitlementId, recordJson)
redis.call('ZADD', availableKey, createdAt, entitlementId)
return {1, entitlementId}
`;

const RECOVER_AND_COUNT_SCRIPT = `
local recordsKey = KEYS[1]
local availableKey = KEYS[2]
local reservedKey = KEYS[3]
local now = tonumber(ARGV[1])
local visitorHash = ARGV[2]
local expired = redis.call('ZRANGEBYSCORE', reservedKey, '-inf', now)
for _, id in ipairs(expired) do
  local raw = redis.call('HGET', recordsKey, id)
  if raw then
    local record = cjson.decode(raw)
    if record.visitorHash == visitorHash and record.status == 'reserved' and tonumber(record.reservationExpiresAt or 0) <= now then
      record.status = 'available'
      record.reservationToken = nil
      record.reservationExpiresAt = nil
      redis.call('HSET', recordsKey, id, cjson.encode(record))
      redis.call('ZADD', availableKey, tonumber(record.createdAt), id)
    end
  end
  redis.call('ZREM', reservedKey, id)
end
local members = redis.call('ZRANGE', availableKey, 0, -1)
local count = 0
for _, id in ipairs(members) do
  local raw = redis.call('HGET', recordsKey, id)
  if raw then
    local record = cjson.decode(raw)
    if record.visitorHash == visitorHash and record.status == 'available' then
      count = count + 1
    else
      redis.call('ZREM', availableKey, id)
    end
  else
    redis.call('ZREM', availableKey, id)
  end
end
return count
`;

const RESERVE_SCRIPT = `
local recordsKey = KEYS[1]
local availableKey = KEYS[2]
local reservedKey = KEYS[3]
local now = tonumber(ARGV[1])
local visitorHash = ARGV[2]
local token = ARGV[3]
local expiresAt = tonumber(ARGV[4])
local expired = redis.call('ZRANGEBYSCORE', reservedKey, '-inf', now)
for _, id in ipairs(expired) do
  local raw = redis.call('HGET', recordsKey, id)
  if raw then
    local record = cjson.decode(raw)
    if record.visitorHash == visitorHash and record.status == 'reserved' and tonumber(record.reservationExpiresAt or 0) <= now then
      record.status = 'available'
      record.reservationToken = nil
      record.reservationExpiresAt = nil
      redis.call('HSET', recordsKey, id, cjson.encode(record))
      redis.call('ZADD', availableKey, tonumber(record.createdAt), id)
    end
  end
  redis.call('ZREM', reservedKey, id)
end
while true do
  local next = redis.call('ZRANGE', availableKey, 0, 0)
  if not next[1] then
    return {}
  end
  local id = next[1]
  redis.call('ZREM', availableKey, id)
  local raw = redis.call('HGET', recordsKey, id)
  if raw then
    local record = cjson.decode(raw)
    if record.visitorHash == visitorHash and record.status == 'available' then
      record.status = 'reserved'
      record.reservationToken = token
      record.reservationExpiresAt = expiresAt
      redis.call('HSET', recordsKey, id, cjson.encode(record))
      redis.call('ZADD', reservedKey, expiresAt, id)
      return {id, token}
    end
  end
end
`;

const CONSUME_SCRIPT = `
local recordsKey = KEYS[1]
local reservedKey = KEYS[2]
local consumedRecordKey = KEYS[3]
local id = ARGV[1]
local visitorHash = ARGV[2]
local token = ARGV[3]
local reportId = ARGV[4]
local now = tonumber(ARGV[5])
local retention = tonumber(ARGV[6])
local raw = redis.call('HGET', recordsKey, id)
if not raw then
  local consumedRaw = redis.call('GET', consumedRecordKey)
  if not consumedRaw then return 0 end
  local consumed = cjson.decode(consumedRaw)
  if consumed.visitorHash == visitorHash and consumed.reportId == reportId then return 1 end
  return 0
end
local record = cjson.decode(raw)
if record.visitorHash ~= visitorHash then return 0 end
if record.status == 'consumed' and record.reportId == reportId then return 1 end
if record.status ~= 'reserved' or record.reservationToken ~= token then return 0 end
record.status = 'consumed'
record.consumedAt = now
record.reportId = reportId
record.reservationToken = nil
record.reservationExpiresAt = nil
redis.call('HDEL', recordsKey, id)
redis.call('SET', consumedRecordKey, cjson.encode(record), 'PX', retention)
redis.call('ZREM', reservedKey, id)
return 1
`;

const RELEASE_SCRIPT = `
local recordsKey = KEYS[1]
local availableKey = KEYS[2]
local reservedKey = KEYS[3]
local id = ARGV[1]
local visitorHash = ARGV[2]
local token = ARGV[3]
local now = tonumber(ARGV[4])
local raw = redis.call('HGET', recordsKey, id)
if not raw then return 0 end
local record = cjson.decode(raw)
if record.visitorHash ~= visitorHash then return 0 end
if record.status == 'available' then return 1 end
if record.status ~= 'reserved' or record.reservationToken ~= token then return 0 end
record.status = 'available'
record.reservationToken = nil
record.reservationExpiresAt = nil
redis.call('HSET', recordsKey, id, cjson.encode(record))
redis.call('ZREM', reservedKey, id)
redis.call('ZADD', availableKey, tonumber(record.createdAt or now), id)
return 1
`;

type RedisEvalClient = {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown>;
};

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export class RedisHumanAuditEntitlementStore
  implements HumanAuditEntitlementStore
{
  constructor(private readonly client: RedisEvalClient) {}

  async create(record: HumanPaidAuditEntitlementRecord): Promise<CreateResult> {
    const result = (await this.client.eval(
      CREATE_SCRIPT,
      3,
      SETTLEMENTS_KEY,
      RECORDS_KEY,
      availableKey(record.visitorHash),
      record.settlementReference,
      record.id,
      JSON.stringify(record),
      record.createdAt
    )) as unknown[];
    return {
      created: numeric(result[0]) === 1,
      entitlementId: String(result[1]),
    };
  }

  async availableCount(visitorHash: string, nowMs: number): Promise<number> {
    return numeric(
      await this.client.eval(
        RECOVER_AND_COUNT_SCRIPT,
        3,
        RECORDS_KEY,
        availableKey(visitorHash),
        reservedKey(visitorHash),
        nowMs,
        visitorHash
      )
    );
  }

  async reserve(input: {
    visitorHash: string;
    reservationToken: string;
    nowMs: number;
    expiresAt: number;
  }): Promise<HumanPaidAuditReservation | null> {
    const result = (await this.client.eval(
      RESERVE_SCRIPT,
      3,
      RECORDS_KEY,
      availableKey(input.visitorHash),
      reservedKey(input.visitorHash),
      input.nowMs,
      input.visitorHash,
      input.reservationToken,
      input.expiresAt
    )) as unknown[];
    if (!result?.[0]) return null;
    return {
      entitlementId: String(result[0]),
      reservationToken: String(result[1]),
    };
  }

  async consume(input: {
    visitorHash: string;
    entitlementId: string;
    reservationToken: string;
    reportId: string;
    nowMs: number;
  }): Promise<boolean> {
    return (
      numeric(
        await this.client.eval(
          CONSUME_SCRIPT,
          3,
          RECORDS_KEY,
          reservedKey(input.visitorHash),
          consumedRecordKey(input.entitlementId),
          input.entitlementId,
          input.visitorHash,
          input.reservationToken,
          input.reportId,
          input.nowMs,
          HUMAN_PAID_AUDIT_CONSUMED_RETENTION_MS
        )
      ) === 1
    );
  }

  async release(input: {
    visitorHash: string;
    entitlementId: string;
    reservationToken: string;
    nowMs: number;
  }): Promise<boolean> {
    return (
      numeric(
        await this.client.eval(
          RELEASE_SCRIPT,
          3,
          RECORDS_KEY,
          availableKey(input.visitorHash),
          reservedKey(input.visitorHash),
          input.entitlementId,
          input.visitorHash,
          input.reservationToken,
          input.nowMs
        )
      ) === 1
    );
  }
}

type MemoryVisitorState = {
  available: Set<string>;
  reserved: Set<string>;
};

export class MemoryHumanAuditEntitlementStore
  implements HumanAuditEntitlementStore
{
  private readonly settlements = new Map<string, string>();
  private readonly records = new Map<string, HumanPaidAuditEntitlementRecord>();
  private readonly visitors = new Map<string, MemoryVisitorState>();

  private visitor(visitorHash: string): MemoryVisitorState {
    let state = this.visitors.get(visitorHash);
    if (!state) {
      state = { available: new Set(), reserved: new Set() };
      this.visitors.set(visitorHash, state);
    }
    return state;
  }

  private recover(visitorHash: string, nowMs: number): void {
    const state = this.visitor(visitorHash);
    for (const id of state.reserved) {
      const record = this.records.get(id);
      if (!record) {
        state.reserved.delete(id);
        continue;
      }
      if (
        record.status === "reserved" &&
        (record.reservationExpiresAt ?? 0) <= nowMs
      ) {
        record.status = "available";
        delete record.reservationToken;
        delete record.reservationExpiresAt;
        state.reserved.delete(id);
        state.available.add(id);
      }
    }
    for (const id of state.available) {
      const record = this.records.get(id);
      if (!record || record.status !== "available") state.available.delete(id);
    }
    for (const [id, record] of this.records) {
      if (
        record.status === "consumed" &&
        (record.consumedAt ?? nowMs) <=
          nowMs - HUMAN_PAID_AUDIT_CONSUMED_RETENTION_MS
      ) {
        this.records.delete(id);
      }
    }
  }

  async create(record: HumanPaidAuditEntitlementRecord): Promise<CreateResult> {
    const existing = this.settlements.get(record.settlementReference);
    if (existing) return { entitlementId: existing, created: false };
    this.settlements.set(record.settlementReference, record.id);
    this.records.set(record.id, { ...record });
    this.visitor(record.visitorHash).available.add(record.id);
    return { entitlementId: record.id, created: true };
  }

  async availableCount(visitorHash: string, nowMs: number): Promise<number> {
    this.recover(visitorHash, nowMs);
    return this.visitor(visitorHash).available.size;
  }

  async reserve(input: {
    visitorHash: string;
    reservationToken: string;
    nowMs: number;
    expiresAt: number;
  }): Promise<HumanPaidAuditReservation | null> {
    this.recover(input.visitorHash, input.nowMs);
    const state = this.visitor(input.visitorHash);
    const id = [...state.available]
      .map((candidate) => this.records.get(candidate))
      .filter((record): record is HumanPaidAuditEntitlementRecord => !!record)
      .sort((left, right) => left.createdAt - right.createdAt)[0]?.id;
    if (!id) return null;
    const record = this.records.get(id);
    if (!record || record.status !== "available") return null;
    state.available.delete(id);
    state.reserved.add(id);
    record.status = "reserved";
    record.reservationToken = input.reservationToken;
    record.reservationExpiresAt = input.expiresAt;
    return { entitlementId: id, reservationToken: input.reservationToken };
  }

  async consume(input: {
    visitorHash: string;
    entitlementId: string;
    reservationToken: string;
    reportId: string;
    nowMs: number;
  }): Promise<boolean> {
    this.recover(input.visitorHash, input.nowMs);
    const record = this.records.get(input.entitlementId);
    if (!record || record.visitorHash !== input.visitorHash) return false;
    if (record.status === "consumed" && record.reportId === input.reportId) {
      return true;
    }
    if (
      record.status !== "reserved" ||
      record.reservationToken !== input.reservationToken
    ) {
      return false;
    }
    this.visitor(input.visitorHash).reserved.delete(input.entitlementId);
    record.status = "consumed";
    record.consumedAt = input.nowMs;
    record.reportId = input.reportId;
    delete record.reservationToken;
    delete record.reservationExpiresAt;
    return true;
  }

  async release(input: {
    visitorHash: string;
    entitlementId: string;
    reservationToken: string;
    nowMs: number;
  }): Promise<boolean> {
    this.recover(input.visitorHash, input.nowMs);
    const record = this.records.get(input.entitlementId);
    if (!record || record.visitorHash !== input.visitorHash) return false;
    if (record.status === "available") return true;
    if (
      record.status !== "reserved" ||
      record.reservationToken !== input.reservationToken
    ) {
      return false;
    }
    const state = this.visitor(input.visitorHash);
    state.reserved.delete(input.entitlementId);
    state.available.add(input.entitlementId);
    record.status = "available";
    delete record.reservationToken;
    delete record.reservationExpiresAt;
    return true;
  }

  readRecord(id: string): HumanPaidAuditEntitlementRecord | undefined {
    const record = this.records.get(id);
    return record ? { ...record } : undefined;
  }
}

let defaultStore: HumanAuditEntitlementStore | undefined;

function humanAuditEntitlementStore(): HumanAuditEntitlementStore {
  if (defaultStore) return defaultStore;
  if (process.env.REDIS_URL) {
    defaultStore = new RedisHumanAuditEntitlementStore(redis);
    return defaultStore;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Human paid audit entitlement storage is not configured");
  }
  defaultStore = new MemoryHumanAuditEntitlementStore();
  return defaultStore;
}

type EntitlementOptions = {
  store?: HumanAuditEntitlementStore;
  nowMs?: number;
};

function canonicalSettlementReference(
  network: string,
  transaction: string
): string {
  return createHash("sha256")
    .update(`x402:v2:${network}:${transaction.toLowerCase()}`)
    .digest("hex");
}

export async function recordSettledHumanAuditEntitlement(
  visitorHash: string,
  settlement: Readonly<SettleResponse>,
  requirements: Readonly<PaymentRequirements>,
  options: EntitlementOptions & { generateId?: () => string } = {}
): Promise<CreateResult> {
  if (
    !settlement.success ||
    !/^0x[0-9a-f]+$/i.test(settlement.transaction) ||
    settlement.network !== requirements.network ||
    requirements.scheme !== "exact" ||
    (settlement.amount !== undefined &&
      settlement.amount !== requirements.amount)
  ) {
    throw new Error("Settled human audit payment metadata is invalid");
  }
  const nowMs = options.nowMs ?? Date.now();
  const record: HumanPaidAuditEntitlementRecord = {
    id: (options.generateId ?? randomUUID)(),
    visitorHash,
    status: "available",
    settlementReference: canonicalSettlementReference(
      settlement.network,
      settlement.transaction
    ),
    transaction: settlement.transaction.toLowerCase(),
    network: settlement.network,
    asset: requirements.asset,
    amount: settlement.amount ?? requirements.amount,
    payTo: requirements.payTo,
    ...(settlement.payer ? { payer: settlement.payer } : {}),
    createdAt: nowMs,
  };
  return (options.store ?? humanAuditEntitlementStore()).create(record);
}

export async function getAvailableHumanAuditEntitlements(
  visitorHash: string,
  options: EntitlementOptions = {}
): Promise<number> {
  return (options.store ?? humanAuditEntitlementStore()).availableCount(
    visitorHash,
    options.nowMs ?? Date.now()
  );
}

export async function reserveHumanAuditEntitlement(
  visitorHash: string,
  options: EntitlementOptions & { generateToken?: () => string } = {}
): Promise<HumanPaidAuditReservation | null> {
  const nowMs = options.nowMs ?? Date.now();
  return (options.store ?? humanAuditEntitlementStore()).reserve({
    visitorHash,
    reservationToken: (options.generateToken ?? randomUUID)(),
    nowMs,
    expiresAt: nowMs + HUMAN_PAID_AUDIT_RESERVATION_TTL_MS,
  });
}

export async function consumeHumanAuditEntitlement(
  visitorHash: string,
  reservation: HumanPaidAuditReservation,
  reportId: string | undefined,
  options: EntitlementOptions & { generateReportId?: () => string } = {}
): Promise<void> {
  const consumed = await (options.store ?? humanAuditEntitlementStore()).consume({
    visitorHash,
    entitlementId: reservation.entitlementId,
    reservationToken: reservation.reservationToken,
    reportId: reportId || (options.generateReportId ?? randomUUID)(),
    nowMs: options.nowMs ?? Date.now(),
  });
  if (!consumed) {
    throw new Error("Human paid audit entitlement reservation expired");
  }
}

export async function releaseHumanAuditEntitlement(
  visitorHash: string,
  reservation: HumanPaidAuditReservation,
  options: EntitlementOptions = {}
): Promise<void> {
  await (options.store ?? humanAuditEntitlementStore()).release({
    visitorHash,
    entitlementId: reservation.entitlementId,
    reservationToken: reservation.reservationToken,
    nowMs: options.nowMs ?? Date.now(),
  });
}
