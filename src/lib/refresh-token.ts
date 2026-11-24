import { logger } from '@/lib/logger';

import { TOKEN_CONFIG } from './token-config';

// Re-export TOKEN_CONFIG for backward compatibility
export { TOKEN_CONFIG };

// Lazy import to avoid Edge Runtime issues in middleware
let getStorage: (() => unknown) | null = null;

/** Redis 类存储暴露的哈希操作（只有部分存储实现带 adapter） */
interface HashAdapter {
  hGet(key: string, field: string): Promise<string | null | undefined>;
  hSet(key: string, field: string, value: string): Promise<unknown>;
  hDel(key: string, field: string): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string> | null | undefined>;
  del(key: string): Promise<unknown>;
}
type HashStorage = { adapter: HashAdapter };

/** 存储带着要用的哈希操作时返回它，否则返回 null（调用方记一条警告后跳过） */
function hashStorageOf(
  storage: unknown,
  ...methods: (keyof HashAdapter)[]
): HashStorage | null {
  const adapter = (storage as { adapter?: Partial<HashAdapter> } | null)
    ?.adapter;
  if (!adapter || methods.some((name) => typeof adapter[name] !== 'function'))
    return null;
  return storage as HashStorage;
}

async function loadStorage() {
  if (!getStorage) {
    const db = await import('./db');
    getStorage = db.getStorage;
  }
  return getStorage();
}

interface TokenData {
  token: string;
  deviceInfo: string;
  createdAt: number;
  expiresAt: number;
  lastUsed: number;
}

// 撤销标记。存储层只有 hGet/hSet/hDel，没有“比较后写入”，
// 验证 refresh token 时写回 lastUsed 可能把刚被撤销的记录又写回去。
// 所以撤销时先留下标记再删记录，验证在写回之后再查标记：
// 两边无论怎样交错，被撤销的 token 最终都会被拒绝并删除。
// 字段为 tokenId（单个设备）或 ALL_DEVICES（该时间点前创建的全部设备），值为撤销时间。
const ALL_DEVICES = 'all';
function revocationKey(username: string) {
  // 不能以 user_tokens: 开头，否则会被 del(user_tokens:<用户>) 的前缀删除一起带走
  return `user_token_revocations:${username}`;
}

async function isRevoked(
  storage: HashStorage,
  username: string,
  tokenId: string,
  createdAt: number
): Promise<boolean> {
  const key = revocationKey(username);
  if (await storage.adapter.hGet(key, tokenId)) return true;
  const all = Number(await storage.adapter.hGet(key, ALL_DEVICES));
  return Number.isFinite(all) && all > 0 && createdAt <= all;
}

// 撤销标记超过 refresh token 有效期后，它能匹配的 token 都已过期，可以删除
async function pruneRevocations(storage: HashStorage, username: string) {
  if (typeof storage.adapter.hGetAll !== 'function') return;
  const key = revocationKey(username);
  const revocations = await storage.adapter.hGetAll(key);
  const now = Date.now();
  for (const [field, revokedAt] of Object.entries(revocations || {})) {
    if (now - Number(revokedAt) > TOKEN_CONFIG.REFRESH_TOKEN_AGE)
      await storage.adapter.hDel(key, field);
  }
}

// 生成随机 Token ID
export function generateTokenId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

// 生成随机 Refresh Token
export function generateRefreshToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

// 存储 Refresh Token（使用 Redis Hash）
export async function storeRefreshToken(
  username: string,
  tokenId: string,
  tokenData: TokenData
): Promise<void> {
  const hashKey = `user_tokens:${username}`;
  const storage = hashStorageOf(await loadStorage(), 'hSet');

  if (!storage) {
    logger.warn('Redis Hash not supported, skipping token storage');
    return;
  }

  try {
    await storage.adapter.hSet(hashKey, tokenId, JSON.stringify(tokenData));
    logger.info(`Stored refresh token for ${username}:${tokenId}`);
  } catch (error) {
    logger.error('Failed to store refresh token:', error);
    throw error;
  }
}

// 验证 Refresh Token
export async function verifyRefreshToken(
  username: string,
  tokenId: string,
  refreshToken: string
): Promise<boolean> {
  const hashKey = `user_tokens:${username}`;
  const storage = hashStorageOf(await loadStorage(), 'hGet', 'hDel', 'hSet');

  if (!storage) {
    logger.warn('Redis Hash not supported');
    return false;
  }

  try {
    const dataStr = await storage.adapter.hGet(hashKey, tokenId);

    if (!dataStr) {
      return false;
    }

    const tokenData: TokenData = JSON.parse(dataStr);

    // 检查是否过期
    if (Date.now() > tokenData.expiresAt) {
      // 过期了，删除
      await storage.adapter.hDel(hashKey, tokenId);
      return false;
    }

    // 验证 Token
    if (tokenData.token !== refreshToken) {
      return false;
    }

    // 更新最后使用时间
    tokenData.lastUsed = Date.now();
    await storage.adapter.hSet(hashKey, tokenId, JSON.stringify(tokenData));

    // 写回之后再查撤销标记：期间若被撤销，删掉刚写回的旧记录并拒绝
    if (await isRevoked(storage, username, tokenId, tokenData.createdAt)) {
      await storage.adapter.hDel(hashKey, tokenId);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to verify refresh token:', error);
    return false;
  }
}

// 撤销单个 Token
export async function revokeRefreshToken(
  username: string,
  tokenId: string
): Promise<void> {
  const hashKey = `user_tokens:${username}`;
  const storage = hashStorageOf(await loadStorage(), 'hSet', 'hDel', 'hGetAll');

  if (!storage) {
    logger.warn('Redis Hash not supported');
    return;
  }

  try {
    // 先留标记再删除，见 isRevoked 上方说明
    if (typeof storage.adapter.hSet === 'function')
      await storage.adapter.hSet(
        revocationKey(username),
        tokenId,
        String(Date.now())
      );
    await storage.adapter.hDel(hashKey, tokenId);
    await pruneRevocations(storage, username);
    logger.info(`Revoked refresh token for ${username}:${tokenId}`);
  } catch (error) {
    logger.error('Failed to revoke refresh token:', error);
  }
}

// 获取用户的所有设备
export async function getUserDevices(username: string): Promise<
  Array<{
    tokenId: string;
    deviceInfo: string;
    createdAt: number;
    lastUsed: number;
    expiresAt: number;
  }>
> {
  const hashKey = `user_tokens:${username}`;
  const storage = hashStorageOf(await loadStorage(), 'hGetAll', 'hDel');

  if (!storage) {
    logger.warn('Redis Hash not supported');
    return [];
  }

  try {
    const allTokens = await storage.adapter.hGetAll(hashKey);

    if (!allTokens || typeof allTokens !== 'object') {
      return [];
    }

    const devices = [];
    const now = Date.now();

    for (const [tokenId, dataStr] of Object.entries(allTokens)) {
      try {
        const tokenData: TokenData = JSON.parse(dataStr as string);

        // 检查是否过期
        if (now > tokenData.expiresAt) {
          // 过期了，删除
          await storage.adapter.hDel(hashKey, tokenId);
          continue;
        }

        devices.push({
          tokenId,
          deviceInfo: tokenData.deviceInfo,
          createdAt: tokenData.createdAt,
          lastUsed: tokenData.lastUsed,
          expiresAt: tokenData.expiresAt,
        });
      } catch (err) {
        logger.error(`Failed to parse token data for ${tokenId}:`, err);
      }
    }

    return devices;
  } catch (error) {
    logger.error('Failed to get user devices:', error);
    return [];
  }
}

// 撤销所有 Token
export async function revokeAllRefreshTokens(username: string): Promise<void> {
  const hashKey = `user_tokens:${username}`;
  const storage = hashStorageOf(
    await loadStorage(),
    'hSet',
    'del',
    'hGetAll',
    'hDel'
  );

  if (!storage) {
    logger.warn('Redis Hash not supported');
    return;
  }

  try {
    // 先留标记再删除；之后新登录的设备创建时间更晚，不受影响
    if (typeof storage.adapter.hSet === 'function')
      await storage.adapter.hSet(
        revocationKey(username),
        ALL_DEVICES,
        String(Date.now())
      );
    await storage.adapter.del(hashKey);
    await pruneRevocations(storage, username);
    logger.info(`Revoked all refresh tokens for ${username}`);
  } catch (error) {
    logger.error('Failed to revoke all refresh tokens:', error);
  }
}

// 清理过期的 Token（定期任务）
export async function cleanupExpiredTokens(username: string): Promise<number> {
  const hashKey = `user_tokens:${username}`;
  const storage = hashStorageOf(await loadStorage(), 'hGetAll', 'hDel');

  if (!storage) {
    return 0;
  }

  try {
    const allTokens = await storage.adapter.hGetAll(hashKey);

    if (!allTokens || typeof allTokens !== 'object') {
      return 0;
    }

    const now = Date.now();
    let cleanedCount = 0;

    for (const [tokenId, dataStr] of Object.entries(allTokens)) {
      try {
        const tokenData: TokenData = JSON.parse(dataStr as string);

        if (now > tokenData.expiresAt) {
          await storage.adapter.hDel(hashKey, tokenId);
          cleanedCount++;
        }
      } catch (err) {
        logger.error(`Failed to parse token data for ${tokenId}:`, err);
      }
    }

    await pruneRevocations(storage, username);

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired tokens for ${username}`);
    }

    return cleanedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens:', error);
    return 0;
  }
}
