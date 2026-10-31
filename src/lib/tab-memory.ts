import {
  clientMemoryScope,
  readClientMemory,
  writeClientMemory,
} from '@/lib/client-memory';

export interface TabVisit {
  href: string;
  top: number;
}
const paths = new Set(['/', '/douban', '/watch-room', '/search', '/my']);
const listeners = new Set<() => void>();
let revision = 0;
let pending:
  | { visit?: TabVisit; scope: string | null; until: number }
  | undefined;

function tabUrl(href: string): URL | undefined {
  try {
    const url = new URL(href, 'https://client.invalid');
    if (url.origin !== 'https://client.invalid' || !paths.has(url.pathname))
      return;
    const clean = new URL(url.pathname, url.origin);
    const allowed =
      url.pathname === '/search'
        ? ['q', 'type']
        : url.pathname === '/douban'
        ? ['type']
        : [];
    allowed.forEach((key) => {
      const value = url.searchParams.get(key);
      if (value) clean.searchParams.set(key, value);
    });
    return clean;
  } catch {
    return;
  }
}

export function savedTabVisit(href: string) {
  const url = tabUrl(href);
  return url ? readClientMemory<TabVisit>(`tab:${url.pathname}`) : undefined;
}

export function rememberTabVisit(href: string, top: number) {
  const url = tabUrl(href);
  if (!url) return;
  const visit = {
    href: url.pathname + url.search,
    top: Number.isFinite(top) ? Math.max(0, top) : 0,
  };
  const old = savedTabVisit(href);
  writeClientMemory(`tab:${url.pathname}`, visit);
  if (savedTabVisit(href)?.href === visit.href && old?.href !== visit.href) {
    revision += 1;
    listeners.forEach((listener) => listener());
  }
}

export function rememberedTabHref(fallback: string) {
  return savedTabVisit(fallback)?.href || fallback;
}

/** Called immediately before a primary-tab route change, including scrub. */
export function prepareTabNavigation(href: string) {
  rememberTabVisit(location.pathname + location.search, window.scrollY);
  const next = rememberedTabHref(href);
  pending =
    next === location.pathname + location.search
      ? undefined
      : {
          visit: savedTabVisit(href),
          scope: clientMemoryScope(),
          until: Date.now() + 6000,
        };
  return next;
}

export const tabNavigationPending = () =>
  Boolean(
    pending &&
      pending.scope === clientMemoryScope() &&
      pending.until > Date.now()
  );

export function takeTabRestore(href: string) {
  const url = tabUrl(href);
  const target = tabNavigationPending() ? pending?.visit : undefined;
  pending = undefined;
  return url && target?.href === url.pathname + url.search ? target : undefined;
}

export const tabMemoryRevision = () => revision;
export const subscribeTabMemory = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
