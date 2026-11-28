import { processSingleton } from './process-singleton';

// 用户信息缓存
interface CachedUserInfo {
  role: 'owner' | 'admin' | 'user';
  banned: boolean;
  tags?: string[];
  oidcSub?: string;
  enabledApis?: string[];
  created_at: number;
  playrecord_migrated?: boolean;
  cachedAt: number;
}

class UserInfoCache {
  private cache: Map<string, CachedUserInfo> = new Map();
  private readonly TTL = 6 * 60 * 60 * 1000; // 6小时过期

  get(username: string): CachedUserInfo | null {
    const cached = this.cache.get(username);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.cachedAt > this.TTL) {
      this.cache.delete(username);
      return null;
    }

    return cached;
  }

  set(username: string, userInfo: Omit<CachedUserInfo, 'cachedAt'>): void {
    this.cache.set(username, {
      ...userInfo,
      cachedAt: Date.now(),
    });
  }

  delete(username: string): void {
    this.cache.delete(username);
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期的缓存
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [username, cached] of entries) {
      if (now - cached.cachedAt > this.TTL) {
        this.cache.delete(username);
      }
    }
  }
}

// 站长存在状态缓存
class OwnerExistenceCache {
  private cache: Map<string, { exists: boolean; cachedAt: number }> = new Map();
  private readonly TTL = 10 * 60 * 1000; // 10分钟过期

  get(ownerUsername: string): boolean | null {
    const cached = this.cache.get(ownerUsername);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.cachedAt > this.TTL) {
      this.cache.delete(ownerUsername);
      return null;
    }

    return cached.exists;
  }

  set(ownerUsername: string, exists: boolean): void {
    this.cache.set(ownerUsername, {
      exists,
      cachedAt: Date.now(),
    });
  }

  delete(ownerUsername: string): void {
    this.cache.delete(ownerUsername);
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期的缓存
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [username, cached] of entries) {
      if (now - cached.cachedAt > this.TTL) {
        this.cache.delete(username);
      }
    }
  }
}

// 全局单例；建好时开始每分钟清理一次过期缓存（后台清理不阻止进程退出）
export const userInfoCache = processSingleton(
  Symbol.for('__MOONTV_USER_INFO_CACHE__'),
  () => {
    const cache = new UserInfoCache();
    setInterval(() => cache.cleanup(), 60 * 1000).unref?.();
    return cache;
  }
);

export const ownerExistenceCache = processSingleton(
  Symbol.for('__MOONTV_OWNER_EXISTENCE_CACHE__'),
  () => {
    const cache = new OwnerExistenceCache();
    setInterval(() => cache.cleanup(), 60 * 1000).unref?.();
    return cache;
  }
);
