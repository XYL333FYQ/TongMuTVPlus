/* eslint-disable no-console */

import { TOKEN_CONFIG } from './token-config';

// Re-export TOKEN_CONFIG for backward compatibility
export { TOKEN_CONFIG };

// Lazy import to avoid Edge Runtime issues in middleware
let getStorage: (() => any) | null = null;

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
  storage: any,
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
async function pruneRevocations(storage: any, username: string) {
  if (typeof storage.adapter?.hGetAll !== 'function') return;
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
  const storage = await loadStorage();

  if (!storage || typeof (storage as any).adapter?.hSet !== 'function') {
    console.warn('Redis Hash not supported, skipping token storage');
    return;
  }

  try {
    await (storage as any).adapter.hSet(
      hashKey,
      tokenId,
      JSON.stringify(tokenData)
    );
    console.log(`Stored refresh token for ${username}:${tokenId}`);
  } catch (error) {
    console.error('Failed to store refresh token:', error);
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
  const storage = await loadStorage();

  if (!storage || typeof (storage as any).adapter?.hGet !== 'function') {
    console.warn('Redis Hash not supported');
    return false;
  }

  try {
    const dataStr = await (storage as any).adapter.hGet(hashKey, tokenId);

    if (!dataStr) {
      return false;
    }

    const tokenData: TokenData = JSON.parse(dataStr);

    // 检查是否过期
    if (Date.now() > tokenData.expiresAt) {
      // 过期了，删除
      await (storage as any).adapter.hDel(hashKey, tokenId);
      return false;
    }

    // 验证 Token
    if (tokenData.token !== refreshToken) {
      return false;
    }

    // 更新最后使用时间
    tokenData.lastUsed = Date.now();
    await (storage as any).adapter.hSet(
      hashKey,
      tokenId,
      JSON.stringify(tokenData)
    );

    // 写回之后再查撤销标记：期间若被撤销，删掉刚写回的旧记录并拒绝
    if (await isRevoked(storage, username, tokenId, tokenData.createdAt)) {
      await (storage as any).adapter.hDel(hashKey, tokenId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to verify refresh token:', error);
    return false;
  }
}

// 撤销单个 Token
export async function revokeRefreshToken(
  username: string,
  tokenId: string
): Promise<void> {
  const hashKey = `user_tokens:${username}`;
  const storage = await loadStorage();

  if (!storage || typeof (storage as any).adapter?.hDel !== 'function') {
    console.warn('Redis Hash not supported');
    return;
  }

  try {
    // 先留标记再删除，见 isRevoked 上方说明
    if (typeof (storage as any).adapter.hSet === 'function')
      await (storage as any).adapter.hSet(
        revocationKey(username),
        tokenId,
        String(Date.now())
      );
    await (storage as any).adapter.hDel(hashKey, tokenId);
    await pruneRevocations(storage, username);
    console.log(`Revoked refresh token for ${username}:${tokenId}`);
  } catch (error) {
    console.error('Failed to revoke refresh token:', error);
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
  const storage = await loadStorage();

  if (!storage || typeof (storage as any).adapter?.hGetAll !== 'function') {
    console.warn('Redis Hash not supported');
    return [];
  }

  try {
    const allTokens = await (storage as any).adapter.hGetAll(hashKey);

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
          await (storage as any).adapter.hDel(hashKey, tokenId);
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
        console.error(`Failed to parse token data for ${tokenId}:`, err);
      }
    }

    return devices;
  } catch (error) {
    console.error('Failed to get user devices:', error);
    return [];
  }
}

// 撤销所有 Token
export async function revokeAllRefreshTokens(username: string): Promise<void> {
  const hashKey = `user_tokens:${username}`;
  const storage = await loadStorage();

  if (!storage || typeof (storage as any).adapter?.del !== 'function') {
    console.warn('Redis Hash not supported');
    return;
  }

  try {
    // 先留标记再删除；之后新登录的设备创建时间更晚，不受影响
    if (typeof (storage as any).adapter.hSet === 'function')
      await (storage as any).adapter.hSet(
        revocationKey(username),
        ALL_DEVICES,
        String(Date.now())
      );
    await (storage as any).adapter.del(hashKey);
    await pruneRevocations(storage, username);
    console.log(`Revoked all refresh tokens for ${username}`);
  } catch (error) {
    console.error('Failed to revoke all refresh tokens:', error);
  }
}

// 清理过期的 Token（定期任务）
export async function cleanupExpiredTokens(username: string): Promise<number> {
  const hashKey = `user_tokens:${username}`;
  const storage = await loadStorage();

  if (!storage || typeof (storage as any).adapter?.hGetAll !== 'function') {
    return 0;
  }

  try {
    const allTokens = await (storage as any).adapter.hGetAll(hashKey);

    if (!allTokens || typeof allTokens !== 'object') {
      return 0;
    }

    const now = Date.now();
    let cleanedCount = 0;

    for (const [tokenId, dataStr] of Object.entries(allTokens)) {
      try {
        const tokenData: TokenData = JSON.parse(dataStr as string);

        if (now > tokenData.expiresAt) {
          await (storage as any).adapter.hDel(hashKey, tokenId);
          cleanedCount++;
        }
      } catch (err) {
        console.error(`Failed to parse token data for ${tokenId}:`, err);
      }
    }

    await pruneRevocations(storage, username);

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired tokens for ${username}`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('Failed to cleanup expired tokens:', error);
    return 0;
  }
}
