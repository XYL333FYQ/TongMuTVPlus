/** @jest-environment ./src/test/node-web-environment.cjs */

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  getAvailableApiSites: jest.fn(),
}));
jest.mock('@/lib/downstream', () => ({
  searchFromApi: jest.fn(),
  getDetailFromApi: jest.fn(),
  getDetailFromApiV2: jest.fn(),
}));
jest.mock('@/lib/emby-token', () => ({
  getProxyToken: jest.fn(async () => 'proxy'),
}));
jest.mock('@/lib/permissions', () => ({
  hasFeaturePermission: jest.fn(async () => false),
}));
jest.mock('@/lib/emby-manager', () => ({
  embyManager: { getAllClients: jest.fn(async () => new Map()) },
}));
jest.mock('@/lib/source-script', () => ({
  listEnabledSourceScripts: jest.fn(async () => []),
  parseScriptSourceValue: jest.fn(() => null),
  executeSavedSourceScript: jest.fn(),
  normalizeScriptSources: jest.fn(() => []),
  normalizeScriptDetailResult: jest.fn(),
}));
jest.mock('@/lib/netdisk/baidu-session-cache', () => ({}));
jest.mock('@/lib/netdisk/mobile-session-cache', () => ({}));
jest.mock('@/lib/netdisk/pan123-session-cache', () => ({}));
jest.mock('@/lib/netdisk/pan115-session-cache', () => ({}));
jest.mock('@/lib/netdisk/quark-session-cache', () => ({}));
jest.mock('@/lib/netdisk/tianyi-session-cache', () => ({}));
jest.mock('@/lib/netdisk/uc-session-cache', () => ({}));

import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import {
  getDetailFromApi,
  getDetailFromApiV2,
  searchFromApi,
} from '@/lib/downstream';
import {
  executeSavedSourceScript,
  normalizeScriptDetailResult,
  parseScriptSourceValue,
} from '@/lib/source-script';

import { GET as detail } from './detail/route';
import { GET as search } from './search/route';
import { GET as sourceDetail } from './source-detail/route';

const site = {
  key: 'fixture',
  api: 'https://cms.test/api.php',
  name: '测试源',
};
const result = {
  id: '1',
  title: '测试影片',
  source: 'fixture',
  source_name: '测试源',
  poster: '',
  year: '2025',
  episodes: ['https://media.test/video.m3u8?signature=private'],
  episodes_titles: ['正片'],
};

function request(path: string, userAgent = 'browser') {
  const data = { username: 'alice', role: 'user', timestamp: Date.now() };
  const auth = {
    ...data,
    signature: createHmac('sha256', 'qa-cache-test')
      .update(JSON.stringify(data))
      .digest('hex'),
    tokenId: 'test-device',
    refreshToken: 'test-refresh',
    refreshExpires: Date.now() + 86400000,
  };
  return new NextRequest(`https://tongmu.test${path}`, {
    headers: {
      cookie: `auth=${encodeURIComponent(JSON.stringify(auth))}`,
      'user-agent': userAgent,
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (getAvailableApiSites as jest.Mock).mockResolvedValue([site]);
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: { DisableYellowFilter: true },
    SourceConfig: [site],
    ClientAdSourceApis: [],
  });
  (searchFromApi as jest.Mock).mockResolvedValue([result]);
  (getDetailFromApi as jest.Mock).mockResolvedValue(result);
  (getDetailFromApiV2 as jest.Mock).mockResolvedValue(result);
  (parseScriptSourceValue as jest.Mock).mockReturnValue(null);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function assertPrivate(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('cdn-cache-control')).toBe('no-store');
  expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
  expect(response.headers.get('vary')).toContain('Cookie');
  expect(response.headers.get('vary')).toContain('Authorization');
}

it.each([
  [search, '/api/search?q=测试'],
  [detail, '/api/detail?source=fixture&id=1'],
  [sourceDetail, '/api/source-detail?source=fixture&id=1'],
])(
  'never publicly caches authenticated responses containing signed playback addresses',
  async (handler, path) => {
    const response = await handler(request(path));
    expect(response.status).toBe(200);
    assertPrivate(response);
    expect(await response.text()).toContain('signature=private');
  }
);

it('keeps an empty authenticated search private as well', async () => {
  const response = await search(request('/api/search'));
  expect(response.status).toBe(200);
  assertPrivate(response);
  expect(await response.json()).toEqual({ results: [] });
});

it.each([detail, sourceDetail])(
  'also prevents shared caching of script-source playback addresses',
  async (handler) => {
    (parseScriptSourceValue as jest.Mock).mockReturnValue({
      scriptKey: 'test-script',
      sourceId: 'fixture',
    });
    (executeSavedSourceScript as jest.Mock).mockResolvedValue({ result: {} });
    (normalizeScriptDetailResult as jest.Mock).mockReturnValue(result);
    const response = await handler(
      request('/api/detail?source=script-fixture&id=1')
    );
    expect(response.status).toBe(200);
    assertPrivate(response);
    expect((await response.json()).episodes).toEqual(result.episodes);
  }
);

it('preserves the configured native-client proxy behavior and its User-Agent variation without public caching', async () => {
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: {},
    SourceConfig: [site],
    ClientAdSourceApis: ['fixture'],
  });
  const response = await sourceDetail(
    request('/api/source-detail?source=fixture&id=1', 'OrionTV')
  );
  assertPrivate(response);
  expect(response.headers.get('vary')).toContain('User-Agent');
  expect((await response.json()).episodes[0]).toContain('/api/proxy-m3u8?url=');
  expect(getDetailFromApiV2).toHaveBeenCalledWith(site, '1');
});
