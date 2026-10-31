import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { getPlatform } from '@/lib/platform';

// UI values and bounded catalogue metadata only. No page trees, media elements,
// credentials or raw response bodies. Nothing is written to persistent storage.
const values = new Map<string, unknown>();
const LIMIT = 64;

export function clientMemoryScope(): string | null {
  if (typeof window === 'undefined' || getPlatform() === 'web') return null;
  return `${getPlatform()}:${
    getAuthInfoFromBrowserCookie()?.username || 'guest'
  }`;
}

export function readClientMemory<T>(
  key: string,
  scope = clientMemoryScope()
): T | undefined {
  return scope ? (values.get(`${scope}\0${key}`) as T | undefined) : undefined;
}

export function writeClientMemory<T>(
  key: string,
  value: T,
  scope = clientMemoryScope()
) {
  // A delayed effect from the old account must not write into the new account.
  if (!scope || scope !== clientMemoryScope()) return;
  const id = `${scope}\0${key}`;
  values.delete(id);
  values.set(id, value);
  if (values.size > LIMIT) {
    const oldest = values.keys().next().value;
    if (oldest !== undefined) values.delete(oldest);
  }
}

export function clearClientMemory() {
  values.clear();
}
