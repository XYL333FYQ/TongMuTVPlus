/** @jest-environment ./src/test/node-web-environment.cjs */

// 内存版 hash 存储；可以把下一次写入 user_tokens 的 hSet 卡住，
// 用来复现“验证读完记录 → 撤销 → 验证再写回旧记录”的交错顺序
const hashes = new Map<string, Map<string, string>>();
let pauseNextTokenWrite = false;
let releasePausedWrite: (() => void) | null = null;
let pausedWriteStarted: (() => void) | null = null;

const adapter = {
  async hSet(key: string, field: string, value: string) {
    if (pauseNextTokenWrite && key.startsWith('user_tokens:')) {
      pauseNextTokenWrite = false;
      await new Promise<void>((resolve) => {
        releasePausedWrite = resolve;
        pausedWriteStarted?.();
      });
    }
    const hash = hashes.get(key) ?? new Map<string, string>();
    hash.set(field, value);
    hashes.set(key, hash);
  },
  async hGet(key: string, field: string) {
    return hashes.get(key)?.get(field) ?? null;
  },
  async hGetAll(key: string) {
    return Object.fromEntries(hashes.get(key) ?? []);
  },
  async hDel(key: string, field: string) {
    hashes.get(key)?.delete(field);
  },
  async del(key: string) {
    hashes.delete(key);
  },
};

jest.mock('./db', () => ({ getStorage: () => ({ adapter }) }));

import {
  cleanupExpiredTokens,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  storeRefreshToken,
  TOKEN_CONFIG,
  verifyRefreshToken,
} from './refresh-token';

const now = Date.now();
function record(token: string, createdAt = now) {
  return {
    token,
    deviceInfo: 'test',
    createdAt,
    expiresAt: createdAt + TOKEN_CONFIG.REFRESH_TOKEN_AGE,
    lastUsed: createdAt,
  };
}

// 让一次验证停在“已读到记录、正要写回 lastUsed”的位置
async function verifyPausedBeforeWrite(tokenId: string, token: string) {
  const started = new Promise<void>((resolve) => {
    pausedWriteStarted = resolve;
  });
  pauseNextTokenWrite = true;
  const pending = verifyRefreshToken('alice', tokenId, token);
  await started;
  return pending;
}

beforeEach(() => {
  hashes.clear();
  pauseNextTokenWrite = false;
  releasePausedWrite = null;
  pausedWriteStarted = null;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('a valid refresh token verifies and records lastUsed', async () => {
  await storeRefreshToken('alice', 'dev1', record('secret', now - 1000));
  await expect(verifyRefreshToken('alice', 'dev1', 'secret')).resolves.toBe(
    true
  );
  await expect(verifyRefreshToken('alice', 'dev1', 'wrong')).resolves.toBe(
    false
  );
  const saved = JSON.parse(
    (await adapter.hGet('user_tokens:alice', 'dev1')) ?? '{}'
  );
  expect(saved.lastUsed).toBeGreaterThan(now - 1000);
});

test('revoking a device while its refresh is in flight cannot bring the token back', async () => {
  await storeRefreshToken('alice', 'dev1', record('secret'));
  const pending = verifyPausedBeforeWrite('dev1', 'secret');

  await revokeRefreshToken('alice', 'dev1');
  releasePausedWrite?.();

  await expect(pending).resolves.toBe(false);
  expect(await adapter.hGet('user_tokens:alice', 'dev1')).toBeNull();
  await expect(verifyRefreshToken('alice', 'dev1', 'secret')).resolves.toBe(
    false
  );
});

test('signing out all devices while a refresh is in flight cannot bring the token back', async () => {
  await storeRefreshToken('alice', 'dev1', record('secret'));
  const pending = verifyPausedBeforeWrite('dev1', 'secret');

  await revokeAllRefreshTokens('alice');
  releasePausedWrite?.();

  await expect(pending).resolves.toBe(false);
  expect(await adapter.hGet('user_tokens:alice', 'dev1')).toBeNull();
});

test('a device that logs in after "sign out everywhere" keeps working', async () => {
  await storeRefreshToken('alice', 'old', record('old-secret', now - 5000));
  await revokeAllRefreshTokens('alice');
  await storeRefreshToken('alice', 'new', record('new-secret', Date.now() + 1));
  await expect(verifyRefreshToken('alice', 'new', 'new-secret')).resolves.toBe(
    true
  );
  await expect(verifyRefreshToken('alice', 'old', 'old-secret')).resolves.toBe(
    false
  );
});

test.each([
  ['cleanup', () => cleanupExpiredTokens('alice')],
  ['a later revoke', () => revokeRefreshToken('alice', 'recent')],
])(
  '%s drops revocation markers once every token they could match has expired',
  async (_name, run) => {
    const longAgo = now - TOKEN_CONFIG.REFRESH_TOKEN_AGE - 1000;
    await storeRefreshToken('alice', 'live', record('secret'));
    await adapter.hSet('user_token_revocations:alice', 'gone', String(longAgo));
    await adapter.hSet('user_token_revocations:alice', 'all', String(longAgo));
    await adapter.hSet('user_token_revocations:alice', 'recent', String(now));
    await run();
    const left = await adapter.hGetAll('user_token_revocations:alice');
    expect(Object.keys(left)).toEqual(['recent']);
  }
);
