import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { readCatalogMemory, writeCatalogMemory } from '@/lib/catalog-memory';
import { clearClientMemory, clientMemoryScope } from '@/lib/client-memory';
import { getPlatform } from '@/lib/platform';

import {
  rememberedTabHref,
  rememberTabVisit,
  savedTabVisit,
} from './tab-memory';

jest.mock('@/lib/auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
jest.mock('@/lib/platform', () => ({ getPlatform: jest.fn() }));
beforeEach(() => {
  clearClientMemory();
  (getPlatform as jest.Mock).mockReturnValue('app');
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
  });
});

test('client primary tabs return to their last submitted route and scroll', () => {
  rememberTabVisit('/search?q=电影&type=video', 640);
  rememberTabVisit('/douban?type=tv', 1280);
  expect(rememberedTabHref('/douban?type=movie')).toBe('/douban?type=tv');
  expect(savedTabVisit('/search')?.top).toBe(640);
  expect(rememberedTabHref('/my')).toBe('/my');
});

test('only known primary routes and public UI parameters enter tab memory', () => {
  rememberTabVisit('/search?q=电影&token=secret#secret', 5);
  expect(rememberedTabHref('/search')).not.toContain('secret');
  rememberTabVisit('/watch-room?roomId=private', 20);
  expect(rememberedTabHref('/watch-room')).toBe('/watch-room');
  rememberTabVisit('/watch-room/screen?id=private', 10);
  rememberTabVisit('https://outside.example/search?q=foreign', 10);
  expect(savedTabVisit('/watch-room/screen')).toBeUndefined();
  expect(rememberedTabHref('/search')).not.toContain('foreign');
});

test('web navigation and a different account use their ordinary target', () => {
  rememberTabVisit('/search?q=电影', 640);
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'bob',
  });
  expect(rememberedTabHref('/search')).toBe('/search');
  (getPlatform as jest.Mock).mockReturnValue('web');
  rememberTabVisit('/douban?type=anime', 100);
  expect(rememberedTabHref('/douban?type=movie')).toBe('/douban?type=movie');
});

test('catalogue return has an absolute five-minute expiry and matches the active filters', () => {
  const saved = {
    signature: 'movie:热门',
    list: [],
    page: 0,
    hasMore: false,
    at: 1000,
  };
  writeCatalogMemory('movie', saved, clientMemoryScope());
  expect(readCatalogMemory('movie', 'movie:热门', 2000)).toEqual(saved);
  expect(readCatalogMemory('movie', 'movie:全部', 2000)).toBeUndefined();
  expect(readCatalogMemory('movie', 'movie:热门', 301000)).toBeUndefined();
});

test('oversized catalogue memory is discarded as a whole, never with a mismatched page counter', () => {
  const saved = {
    signature: 'movie',
    list: [{ id: 'a', title: 'a', poster: '', rate: '', year: '' }],
    page: 0,
    hasMore: true,
    at: 1000,
  };
  writeCatalogMemory('movie', saved, clientMemoryScope());
  writeCatalogMemory(
    'movie',
    {
      ...saved,
      list: Array.from({ length: 301 }, () => saved.list[0]),
      page: 12,
    },
    clientMemoryScope()
  );
  expect(readCatalogMemory('movie', 'movie', 2000)).toBeUndefined();
});
