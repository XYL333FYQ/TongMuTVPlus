import { NextRequest } from 'next/server';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const BAN_DURATIONS_MS = [
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const RECORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface LoginFail2BanRecord {
  failures: number[];
  bannedUntil: number;
  banLevel: number;
  lastSeen: number;
}

interface LoginFail2BanStore {
  records: Map<string, LoginFail2BanRecord>;
  lastCleanup: number;
}

interface LoginFail2BanGlobal {
  __loginFail2BanStore?: LoginFail2BanStore;
}

export interface LoginBanStatus {
  banned: boolean;
  bannedUntil?: number;
  retryAfterSeconds?: number;
}

export interface LoginFailureResult extends LoginBanStatus {
  failureCount: number;
  banLevel: number;
}

function getStore(): LoginFail2BanStore {
  const globalStore = globalThis as typeof globalThis & LoginFail2BanGlobal;
  if (!globalStore.__loginFail2BanStore) {
    globalStore.__loginFail2BanStore = {
      records: new Map<string, LoginFail2BanRecord>(),
      lastCleanup: Date.now(),
    };
  }

  return globalStore.__loginFail2BanStore;
}

function cleanupExpiredRecords(now: number) {
  const store = getStore();
  if (now - store.lastCleanup < CLEANUP_INTERVAL_MS) return;

  for (const [ip, record] of Array.from(store.records.entries())) {
    const hasActiveBan = record.bannedUntil > now;
    const recentlySeen = now - record.lastSeen < RECORD_TTL_MS;

    if (!hasActiveBan && !recentlySeen) {
      store.records.delete(ip);
    }
  }

  store.lastCleanup = now;
}

function pruneFailures(record: LoginFail2BanRecord, now: number) {
  record.failures = record.failures.filter((time) => now - time <= WINDOW_MS);
}

function normalizeIp(ip: string): string | null {
  const normalized = ip.trim();
  if (!normalized || normalized.toLowerCase() === 'unknown') return null;
  return normalized;
}

export function getLoginClientIp(req: NextRequest): string | null {
  const cfConnectingIp = normalizeIp(req.headers.get('cf-connecting-ip') || '');
  if (cfConnectingIp) return cfConnectingIp;

  const xRealIp = normalizeIp(req.headers.get('x-real-ip') || '');
  if (xRealIp) return xRealIp;

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = normalizeIp(xForwardedFor.split(',')[0] || '');
    if (firstIp) return firstIp;
  }

  const forwarded = req.headers.get('forwarded');
  if (forwarded) {
    const match = forwarded.match(/for=(?:"?)([^;,"]+)/i);
    const forwardedIp = normalizeIp(match?.[1]?.replace(/^\[|\]$/g, '') || '');
    if (forwardedIp) return forwardedIp;
  }

  return null;
}

export function checkLoginBan(
  ip: string | null,
  now = Date.now()
): LoginBanStatus {
  if (!ip) return { banned: false };

  cleanupExpiredRecords(now);

  const record = getStore().records.get(ip);
  if (!record) return { banned: false };

  record.lastSeen = now;
  if (record.bannedUntil > now) {
    return {
      banned: true,
      bannedUntil: record.bannedUntil,
      retryAfterSeconds: Math.ceil((record.bannedUntil - now) / 1000),
    };
  }

  pruneFailures(record, now);
  return { banned: false };
}

export function recordLoginFailure(
  ip: string | null,
  now = Date.now()
): LoginFailureResult {
  if (!ip) {
    return { banned: false, failureCount: 0, banLevel: 0 };
  }

  cleanupExpiredRecords(now);

  const store = getStore();
  const record = store.records.get(ip) || {
    failures: [],
    bannedUntil: 0,
    banLevel: 0,
    lastSeen: now,
  };

  record.lastSeen = now;
  pruneFailures(record, now);
  record.failures.push(now);

  if (record.failures.length >= MAX_FAILURES) {
    record.banLevel += 1;
    const durationIndex = Math.min(
      record.banLevel - 1,
      BAN_DURATIONS_MS.length - 1
    );
    record.bannedUntil = now + BAN_DURATIONS_MS[durationIndex];
    record.failures = [];
  }

  store.records.set(ip, record);

  if (record.bannedUntil > now) {
    return {
      banned: true,
      bannedUntil: record.bannedUntil,
      retryAfterSeconds: Math.ceil((record.bannedUntil - now) / 1000),
      failureCount: record.failures.length,
      banLevel: record.banLevel,
    };
  }

  return {
    banned: false,
    failureCount: record.failures.length,
    banLevel: record.banLevel,
  };
}

export function recordLoginSuccess(ip: string | null, now = Date.now()) {
  if (!ip) return;

  const record = getStore().records.get(ip);
  if (!record) return;

  record.failures = [];
  record.lastSeen = now;
}

// —— 按账号限流 ——
// 按 IP 限流依赖代理头，直接暴露在公网时可被伪造的 X-Forwarded-For 绕过。
// 再按用户名限流：同一账号 15 分钟内输错 10 次，锁定 15 分钟（不逐级加长，
// 避免被人故意锁死站长账号太久；重启服务也会清空）。
// 曾经成功登录过这个账号的 IP 不受账号锁定影响：别人从各处乱试锁住账号时，
// 本人在常用网络上仍能登录（这些 IP 依旧受上面按 IP 的限流约束）。
const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_MAX_FAILURES = 10;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const TRUSTED_IPS_PER_ACCOUNT = 5;
const TRUSTED_IP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface TrustedIpGlobal {
  __loginTrustedIps?: Map<string, Map<string, number>>;
}

function getTrustedStore() {
  const g = globalThis as typeof globalThis & TrustedIpGlobal;
  if (!g.__loginTrustedIps) g.__loginTrustedIps = new Map();
  return g.__loginTrustedIps;
}

function isTrustedIp(
  key: string,
  clientIp: string | null | undefined,
  now: number
) {
  if (!clientIp) return false;
  const seen = getTrustedStore().get(key)?.get(clientIp);
  return seen !== undefined && now - seen <= TRUSTED_IP_TTL_MS;
}

interface AccountLockGlobal {
  __loginAccountLocks?: Map<
    string,
    { failures: number[]; lockedUntil: number }
  >;
}

function getAccountStore() {
  const g = globalThis as typeof globalThis & AccountLockGlobal;
  if (!g.__loginAccountLocks) g.__loginAccountLocks = new Map();
  return g.__loginAccountLocks;
}

function accountKey(username: unknown): string | null {
  if (typeof username !== 'string') return null;
  const key = username.trim().toLowerCase();
  return key ? key : null;
}

export function checkAccountLock(
  username: unknown,
  now = Date.now(),
  clientIp?: string | null
): LoginBanStatus {
  const key = accountKey(username);
  if (!key) return { banned: false };
  const record = getAccountStore().get(key);
  if (!record || record.lockedUntil <= now) return { banned: false };
  if (isTrustedIp(key, clientIp, now)) return { banned: false };
  return {
    banned: true,
    bannedUntil: record.lockedUntil,
    retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
  };
}

export function recordAccountFailure(username: unknown, now = Date.now()) {
  const key = accountKey(username);
  if (!key) return;
  const store = getAccountStore();
  const record = store.get(key) || { failures: [], lockedUntil: 0 };
  record.failures = record.failures.filter(
    (time) => now - time <= ACCOUNT_WINDOW_MS
  );
  record.failures.push(now);
  if (record.failures.length >= ACCOUNT_MAX_FAILURES) {
    record.lockedUntil = now + ACCOUNT_LOCK_MS;
    record.failures = [];
  }
  store.set(key, record);
  // 防止大量随机用户名把内存撑大
  if (store.size > 10000) {
    for (const [name, value] of Array.from(store.entries())) {
      if (value.lockedUntil <= now && value.failures.length === 0) {
        store.delete(name);
      }
    }
  }
}

export function recordAccountSuccess(
  username: unknown,
  clientIp?: string | null,
  now = Date.now()
) {
  const key = accountKey(username);
  if (!key) return;
  getAccountStore().delete(key);
  if (!clientIp) return;
  const store = getTrustedStore();
  const ips = store.get(key) || new Map<string, number>();
  ips.delete(clientIp);
  ips.set(clientIp, now);
  // 只记最近几个，Map 按插入顺序，先删最旧的
  while (ips.size > TRUSTED_IPS_PER_ACCOUNT) {
    ips.delete(ips.keys().next().value as string);
  }
  store.set(key, ips);
  if (store.size > 10000) store.delete(store.keys().next().value as string);
}
