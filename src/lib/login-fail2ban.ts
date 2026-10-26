import { NextRequest } from 'next/server';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
// 固定 15 分钟，不逐级加长：同一出口 IP 下常有多个真人（宿舍、校园网、运营商共享 IP），
// 加长的封禁会让一个人输错连累所有人好几个小时
const BAN_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const RECORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface LoginFail2BanRecord {
  failures: number[];
  bannedUntil: number;
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

// 取访客 IP。只认反向代理自己写入的值，客户端能随便填的头一律不信：
// - X-Real-IP：nginx 用 proxy_set_header X-Real-IP $remote_addr 写入，会覆盖客户端带来的同名头
// - X-Forwarded-For 的最后一段：nginx 的 $proxy_add_x_forwarded_for 追加的是它看到的连接地址，
//   第一段则是客户端可以伪造的，不能用
// - CF-Connecting-IP：只有站点真的在 Cloudflare 后面（TRUST_CF_CONNECTING_IP=true）才信。
//   否则任何人都能伪造它，去封别人的 IP 或绕过自己的封禁
export function getLoginClientIp(req: NextRequest): string | null {
  if (process.env.TRUST_CF_CONNECTING_IP === 'true') {
    const cfConnectingIp = normalizeIp(
      req.headers.get('cf-connecting-ip') || ''
    );
    if (cfConnectingIp) return cfConnectingIp;
  }

  const xRealIp = normalizeIp(req.headers.get('x-real-ip') || '');
  if (xRealIp) return xRealIp;

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const parts = xForwardedFor.split(',');
    const lastIp = normalizeIp(parts[parts.length - 1] || '');
    if (lastIp) return lastIp;
  }

  return null;
}

// 把剩余秒数说成人话：不足一分钟说秒，否则向上取整到分钟
export function formatRetryWait(seconds: number | undefined): string {
  const total = Math.max(1, Math.ceil(seconds || 0));
  if (total < 60) return `${total} 秒`;
  return `${Math.ceil(total / 60)} 分钟`;
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
    return { banned: false, failureCount: 0 };
  }

  cleanupExpiredRecords(now);

  const store = getStore();
  const record = store.records.get(ip) || {
    failures: [],
    bannedUntil: 0,
    lastSeen: now,
  };

  record.lastSeen = now;
  pruneFailures(record, now);
  record.failures.push(now);

  if (record.failures.length >= MAX_FAILURES) {
    record.bannedUntil = now + BAN_MS;
    record.failures = [];
  }

  store.records.set(ip, record);

  if (record.bannedUntil > now) {
    return {
      banned: true,
      bannedUntil: record.bannedUntil,
      retryAfterSeconds: Math.ceil((record.bannedUntil - now) / 1000),
      failureCount: record.failures.length,
    };
  }

  return {
    banned: false,
    failureCount: record.failures.length,
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
// 按 IP 限流依赖代理写入的真实 IP，直接暴露在公网（没有反向代理）时读不到 IP，就不做 IP 限流。
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
