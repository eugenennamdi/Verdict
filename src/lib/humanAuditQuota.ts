import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import {
  HUMAN_AUDIT_QUOTA_LIMIT,
  HUMAN_AUDIT_QUOTA_WINDOW_MS,
  type HumanAuditQuotaState,
} from "@/lib/humanAuditQuotaContract";

export const HUMAN_AUDIT_RESERVATION_TTL_MS = 10 * 60 * 1_000;

type StoredQuotaState = {
  used: number;
  reserved: number;
  oldestSuccessAt: number | null;
  oldestReservationExpiry: number | null;
};

export interface HumanAuditQuotaStore {
  read(identity: string, nowMs: number): Promise<StoredQuotaState>;
  reserve(input: {
    identity: string;
    token: string;
    nowMs: number;
    expiresAt: number;
    limit: number;
  }): Promise<{ accepted: boolean; state: StoredQuotaState }>;
  commit(input: {
    identity: string;
    token: string;
    successId: string;
    nowMs: number;
  }): Promise<{ committed: boolean; state: StoredQuotaState }>;
  release(identity: string, token: string, nowMs: number): Promise<StoredQuotaState>;
}

const READ_SCRIPT = `
local successKey = KEYS[1]
local reservationKey = KEYS[2]
local cutoff = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', successKey, '-inf', cutoff)
redis.call('ZREMRANGEBYSCORE', reservationKey, '-inf', now)
local used = redis.call('ZCARD', successKey)
local reserved = redis.call('ZCARD', reservationKey)
local oldestSuccess = redis.call('ZRANGE', successKey, 0, 0, 'WITHSCORES')
local oldestReservation = redis.call('ZRANGE', reservationKey, 0, 0, 'WITHSCORES')
return {used, reserved, oldestSuccess[2] or '', oldestReservation[2] or ''}
`;

const RESERVE_SCRIPT = `
local successKey = KEYS[1]
local reservationKey = KEYS[2]
local cutoff = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]
local expiresAt = tonumber(ARGV[5])
redis.call('ZREMRANGEBYSCORE', successKey, '-inf', cutoff)
redis.call('ZREMRANGEBYSCORE', reservationKey, '-inf', now)
local used = redis.call('ZCARD', successKey)
local reserved = redis.call('ZCARD', reservationKey)
local accepted = 0
if used + reserved < limit then
  redis.call('ZADD', reservationKey, expiresAt, token)
  redis.call('PEXPIRE', reservationKey, tonumber(ARGV[6]))
  reserved = reserved + 1
  accepted = 1
end
local oldestSuccess = redis.call('ZRANGE', successKey, 0, 0, 'WITHSCORES')
local oldestReservation = redis.call('ZRANGE', reservationKey, 0, 0, 'WITHSCORES')
return {accepted, used, reserved, oldestSuccess[2] or '', oldestReservation[2] or ''}
`;

const COMMIT_SCRIPT = `
local successKey = KEYS[1]
local reservationKey = KEYS[2]
local cutoff = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local token = ARGV[3]
local successId = ARGV[4]
redis.call('ZREMRANGEBYSCORE', successKey, '-inf', cutoff)
redis.call('ZREMRANGEBYSCORE', reservationKey, '-inf', now)
local committed = 0
if redis.call('ZSCORE', successKey, successId) then
  committed = 1
elseif redis.call('ZREM', reservationKey, token) == 1 then
  redis.call('ZADD', successKey, now, successId)
  redis.call('PEXPIRE', successKey, tonumber(ARGV[5]))
  committed = 1
end
local used = redis.call('ZCARD', successKey)
local reserved = redis.call('ZCARD', reservationKey)
local oldestSuccess = redis.call('ZRANGE', successKey, 0, 0, 'WITHSCORES')
local oldestReservation = redis.call('ZRANGE', reservationKey, 0, 0, 'WITHSCORES')
return {committed, used, reserved, oldestSuccess[2] or '', oldestReservation[2] or ''}
`;

const RELEASE_SCRIPT = `
local successKey = KEYS[1]
local reservationKey = KEYS[2]
local cutoff = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', successKey, '-inf', cutoff)
redis.call('ZREMRANGEBYSCORE', reservationKey, '-inf', now)
redis.call('ZREM', reservationKey, ARGV[3])
local used = redis.call('ZCARD', successKey)
local reserved = redis.call('ZCARD', reservationKey)
local oldestSuccess = redis.call('ZRANGE', successKey, 0, 0, 'WITHSCORES')
local oldestReservation = redis.call('ZRANGE', reservationKey, 0, 0, 'WITHSCORES')
return {used, reserved, oldestSuccess[2] or '', oldestReservation[2] or ''}
`;

function quotaKeys(identity: string): [string, string] {
  return [
    `human_audit_quota:{${identity}}:successes`,
    `human_audit_quota:{${identity}}:reservations`,
  ];
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function storedState(values: unknown[], offset = 0): StoredQuotaState {
  return {
    used: numberValue(values[offset]),
    reserved: numberValue(values[offset + 1]),
    oldestSuccessAt: optionalNumber(values[offset + 2]),
    oldestReservationExpiry: optionalNumber(values[offset + 3]),
  };
}

export class RedisHumanAuditQuotaStore implements HumanAuditQuotaStore {
  constructor(
    private readonly client: {
      eval(
        script: string,
        numberOfKeys: number,
        ...args: Array<string | number>
      ): Promise<unknown>;
    }
  ) {}

  async read(identity: string, nowMs: number): Promise<StoredQuotaState> {
    const keys = quotaKeys(identity);
    const result = (await this.client.eval(
      READ_SCRIPT,
      2,
      ...keys,
      nowMs - HUMAN_AUDIT_QUOTA_WINDOW_MS,
      nowMs
    )) as unknown[];
    return storedState(result);
  }

  async reserve(input: {
    identity: string;
    token: string;
    nowMs: number;
    expiresAt: number;
    limit: number;
  }): Promise<{ accepted: boolean; state: StoredQuotaState }> {
    const keys = quotaKeys(input.identity);
    const result = (await this.client.eval(
      RESERVE_SCRIPT,
      2,
      ...keys,
      input.nowMs - HUMAN_AUDIT_QUOTA_WINDOW_MS,
      input.nowMs,
      input.limit,
      input.token,
      input.expiresAt,
      HUMAN_AUDIT_RESERVATION_TTL_MS + 60_000
    )) as unknown[];
    return {
      accepted: numberValue(result[0]) === 1,
      state: storedState(result, 1),
    };
  }

  async commit(input: {
    identity: string;
    token: string;
    successId: string;
    nowMs: number;
  }): Promise<{ committed: boolean; state: StoredQuotaState }> {
    const keys = quotaKeys(input.identity);
    const result = (await this.client.eval(
      COMMIT_SCRIPT,
      2,
      ...keys,
      input.nowMs - HUMAN_AUDIT_QUOTA_WINDOW_MS,
      input.nowMs,
      input.token,
      input.successId,
      HUMAN_AUDIT_QUOTA_WINDOW_MS + 60_000
    )) as unknown[];
    return {
      committed: numberValue(result[0]) === 1,
      state: storedState(result, 1),
    };
  }

  async release(
    identity: string,
    token: string,
    nowMs: number
  ): Promise<StoredQuotaState> {
    const keys = quotaKeys(identity);
    const result = (await this.client.eval(
      RELEASE_SCRIPT,
      2,
      ...keys,
      nowMs - HUMAN_AUDIT_QUOTA_WINDOW_MS,
      nowMs,
      token
    )) as unknown[];
    return storedState(result);
  }
}

type MemoryVisitorState = {
  successes: Map<string, number>;
  reservations: Map<string, number>;
};

export class MemoryHumanAuditQuotaStore implements HumanAuditQuotaStore {
  private readonly visitors = new Map<string, MemoryVisitorState>();

  private state(identity: string): MemoryVisitorState {
    let state = this.visitors.get(identity);
    if (!state) {
      state = { successes: new Map(), reservations: new Map() };
      this.visitors.set(identity, state);
    }
    return state;
  }

  private inspect(identity: string, nowMs: number): StoredQuotaState {
    const state = this.state(identity);
    const cutoff = nowMs - HUMAN_AUDIT_QUOTA_WINDOW_MS;
    for (const [id, timestamp] of state.successes) {
      if (timestamp <= cutoff) state.successes.delete(id);
    }
    for (const [token, expiresAt] of state.reservations) {
      if (expiresAt <= nowMs) state.reservations.delete(token);
    }
    const successTimes = [...state.successes.values()].sort((a, b) => a - b);
    const reservationTimes = [...state.reservations.values()].sort(
      (a, b) => a - b
    );
    return {
      used: successTimes.length,
      reserved: reservationTimes.length,
      oldestSuccessAt: successTimes[0] ?? null,
      oldestReservationExpiry: reservationTimes[0] ?? null,
    };
  }

  async read(identity: string, nowMs: number): Promise<StoredQuotaState> {
    return this.inspect(identity, nowMs);
  }

  async reserve(input: {
    identity: string;
    token: string;
    nowMs: number;
    expiresAt: number;
    limit: number;
  }): Promise<{ accepted: boolean; state: StoredQuotaState }> {
    const current = this.inspect(input.identity, input.nowMs);
    if (current.used + current.reserved >= input.limit) {
      return { accepted: false, state: current };
    }
    this.state(input.identity).reservations.set(input.token, input.expiresAt);
    return { accepted: true, state: this.inspect(input.identity, input.nowMs) };
  }

  async commit(input: {
    identity: string;
    token: string;
    successId: string;
    nowMs: number;
  }): Promise<{ committed: boolean; state: StoredQuotaState }> {
    const state = this.state(input.identity);
    this.inspect(input.identity, input.nowMs);
    if (state.successes.has(input.successId)) {
      return {
        committed: true,
        state: this.inspect(input.identity, input.nowMs),
      };
    }
    if (!state.reservations.delete(input.token)) {
      return {
        committed: false,
        state: this.inspect(input.identity, input.nowMs),
      };
    }
    state.successes.set(input.successId, input.nowMs);
    return { committed: true, state: this.inspect(input.identity, input.nowMs) };
  }

  async release(
    identity: string,
    token: string,
    nowMs: number
  ): Promise<StoredQuotaState> {
    const state = this.state(identity);
    this.inspect(identity, nowMs);
    state.reservations.delete(token);
    return this.inspect(identity, nowMs);
  }
}

let defaultStore: HumanAuditQuotaStore | undefined;

function humanAuditQuotaStore(): HumanAuditQuotaStore {
  if (defaultStore) return defaultStore;
  if (process.env.REDIS_URL) {
    defaultStore = new RedisHumanAuditQuotaStore(redis);
    return defaultStore;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Human audit quota storage is not configured");
  }
  defaultStore = new MemoryHumanAuditQuotaStore();
  return defaultStore;
}

function publicState(state: StoredQuotaState): HumanAuditQuotaState {
  const remaining = Math.max(
    0,
    HUMAN_AUDIT_QUOTA_LIMIT - state.used - state.reserved
  );
  const nextCandidates = [
    state.oldestSuccessAt === null
      ? null
      : state.oldestSuccessAt + HUMAN_AUDIT_QUOTA_WINDOW_MS,
    state.oldestReservationExpiry,
  ].filter((value): value is number => value !== null);

  return {
    limit: HUMAN_AUDIT_QUOTA_LIMIT,
    used: state.used,
    remaining,
    nextAvailableAt:
      remaining > 0 || nextCandidates.length === 0
        ? null
        : new Date(Math.min(...nextCandidates)).toISOString(),
  };
}

type QuotaOptions = {
  store?: HumanAuditQuotaStore;
  nowMs?: number;
};

export type HumanAuditAccessDecision =
  | {
      allowed: true;
      accessType: "free";
      reservationToken: string;
      quota: HumanAuditQuotaState;
    }
  | {
      allowed: false;
      reason: "quota_exhausted";
      quota: HumanAuditQuotaState;
    };

export async function getHumanAuditQuota(
  identity: string,
  options: QuotaOptions = {}
): Promise<HumanAuditQuotaState> {
  const nowMs = options.nowMs ?? Date.now();
  const state = await (options.store ?? humanAuditQuotaStore()).read(
    identity,
    nowMs
  );
  return publicState(state);
}

export async function canStartHumanAudit(
  identity: string,
  options: QuotaOptions & { generateToken?: () => string } = {}
): Promise<HumanAuditAccessDecision> {
  const nowMs = options.nowMs ?? Date.now();
  const token = (options.generateToken ?? randomUUID)();
  const reservation = await (options.store ?? humanAuditQuotaStore()).reserve({
    identity,
    token,
    nowMs,
    expiresAt: nowMs + HUMAN_AUDIT_RESERVATION_TTL_MS,
    limit: HUMAN_AUDIT_QUOTA_LIMIT,
  });
  if (!reservation.accepted) {
    return {
      allowed: false,
      reason: "quota_exhausted",
      quota: publicState(reservation.state),
    };
  }
  return {
    allowed: true,
    accessType: "free",
    reservationToken: token,
    quota: publicState(reservation.state),
  };
}

export async function recordSuccessfulHumanAudit(
  identity: string,
  reservationToken: string,
  reportId: string | undefined,
  options: QuotaOptions & { generateSuccessId?: () => string } = {}
): Promise<HumanAuditQuotaState> {
  const nowMs = options.nowMs ?? Date.now();
  const successId = `success:${reportId || (options.generateSuccessId ?? randomUUID)()}`;
  const result = await (options.store ?? humanAuditQuotaStore()).commit({
    identity,
    token: reservationToken,
    successId,
    nowMs,
  });
  if (!result.committed) {
    throw new Error("Human audit quota reservation expired before completion");
  }
  return publicState(result.state);
}

export async function releaseHumanAuditReservation(
  identity: string,
  reservationToken: string,
  options: QuotaOptions = {}
): Promise<HumanAuditQuotaState> {
  const nowMs = options.nowMs ?? Date.now();
  const state = await (options.store ?? humanAuditQuotaStore()).release(
    identity,
    reservationToken,
    nowMs
  );
  return publicState(state);
}
