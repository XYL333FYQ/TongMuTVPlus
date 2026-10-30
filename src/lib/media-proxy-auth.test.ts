/** @jest-environment ./src/test/node-web-environment.cjs */

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  getAvailableApiSites: jest.fn(),
}));
jest.mock('@/lib/db', () => ({
  db: { getUsernameByTvboxToken: jest.fn(), getUserInfoV2: jest.fn() },
}));
jest.mock('@/lib/server/ssrf', () => ({
  validateProxyUrlServerSide: jest.fn(async () => true),
}));
jest.mock('@/lib/tmdb.search', () => ({ getTMDBImageUrl: jest.fn() }));
jest.mock('@/lib/openlist-cache', () => ({
  getCachedMetaInfo: jest.fn(),
  setCachedMetaInfo: jest.fn(),
}));
jest.mock('@/lib/live', () => ({ getCachedLiveChannels: jest.fn() }));
jest.mock('@/lib/permissions', () => ({
  hasFeaturePermission: jest.fn(async () => true),
}));
jest.mock('@/lib/emby-manager', () => ({
  embyManager: { getEnabledSources: jest.fn(async () => []) },
}));
jest.mock('@/lib/openlist.client', () => ({ OpenListClient: jest.fn() }));
jest.mock('@/lib/openlist-proxy-cache', () => ({
  getCachedOpenListProxyUrl: jest.fn(),
  setCachedOpenListProxyUrl: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { createHmac, webcrypto } from 'node:crypto';

import { getAvailableApiSites, getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { getProxyToken } from '@/lib/emby-token';
import { validateProxyUrlServerSide } from '@/lib/server/ssrf';

import { GET as cmsProxy } from '@/app/api/cms-proxy/route';
import { GET as embyImage } from '@/app/api/emby/image/[token]/[itemId]/route';
import { GET as embyPlay } from '@/app/api/emby/play/[token]/[filename]/route';
import { GET as embySubtitle } from '@/app/api/emby/subtitle/[token]/[filename]/route';
import { GET as openlistPlay } from '@/app/api/openlist/play/[token]/route';
import { GET as openlistStream } from '@/app/api/openlist/proxy/[token]/[filename]/route';
import { GET as segmentProxy } from '@/app/api/proxy/vod/segment/route';
import { GET as m3u8Proxy } from '@/app/api/proxy-m3u8/route';
import { GET as subscribe } from '@/app/api/tvbox/subscribe/route';

const sites = [
  {
    key: 'fixture',
    name: '公共源',
    api: 'https://cms.test/api.php?sourceKey=upstream-secret',
    proxyMode: true,
  },
];
const request = (path: string, cookie?: string) =>
  new NextRequest(`https://tongmu.test${path}`, {
    headers: {
      host: 'tongmu.test',
      ...(cookie ? { cookie: `auth=${cookie}` } : {}),
    },
  });
const cmsPath = `/api/cms-proxy?api=${encodeURIComponent(
  sites[0].api
)}&ac=videolist`;
const m3u8Path =
  '/api/proxy-m3u8?url=https%3A%2F%2Fcdn.test%2Fmaster.m3u8&source=fixture&adblock=false';
const segmentPath =
  '/api/proxy/vod/segment?url=https%3A%2F%2Fcdn.test%2Fpart.ts&source=fixture';
const fetchMock = jest.fn();

function signedCookie() {
  const data = { username: 'alice', role: 'user', timestamp: Date.now() };
  return encodeURIComponent(
    JSON.stringify({
      ...data,
      signature: createHmac('sha256', 'test-secret')
        .update(JSON.stringify(data))
        .digest('hex'),
      tokenId: 'device-1',
      refreshToken: 'refresh-1',
      refreshExpires: Date.now() + 86400000,
    })
  );
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  process.env.PASSWORD = 'test-secret';
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'sqlite';
  process.env.ENABLE_TVBOX_SUBSCRIBE = 'true';
  process.env.TVBOX_SUBSCRIBE_TOKEN = 'external-tvbox-token';
  process.env.SITE_BASE = 'https://tongmu.test';
  delete process.env.NEXT_PUBLIC_PROXY_M3U8_TOKEN;
  delete process.env.PROXY_M3U8_TOKEN;
  global.fetch = fetchMock;
  (getAvailableApiSites as jest.Mock).mockResolvedValue(sites);
  (getConfig as jest.Mock).mockResolvedValue({
    SiteConfig: {},
    SourceConfig: sites,
    LiveConfig: [],
  });
  (db.getUsernameByTvboxToken as jest.Mock).mockResolvedValue(null);
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue(null);
});

it.each([
  [cmsProxy, cmsPath],
  [m3u8Proxy, m3u8Path],
  [segmentProxy, segmentPath],
])(
  'rejects anonymous and forged-cookie proxy access before fetch',
  async (handler, path) => {
    expect((await handler(request(path))).status).toBe(401);
    const forged = encodeURIComponent(
      JSON.stringify({ username: 'alice', role: 'owner' })
    );
    expect((await handler(request(path, forged))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getConfig).not.toHaveBeenCalled();
  }
);

it('retains signed-session CMS playback without handing out the server proxy secret', async () => {
  process.env.NEXT_PUBLIC_PROXY_M3U8_TOKEN = 'server-secret-never-return';
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        list: [
          {
            vod_name: '电影',
            vod_play_from: 'fixture',
            vod_play_url: '正片$https://cdn.test/master.m3u8?sig=original',
          },
        ],
      })
    )
  );
  const response = await cmsProxy(request(cmsPath, signedCookie()));
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('/api/proxy-m3u8?');
  expect(body).not.toContain('server-secret-never-return');
});

it('preserves the authorized TVBox token across subscribe, CMS, child playlists, keys and segments', async () => {
  const subscription = await subscribe(
    request('/api/tvbox/subscribe?token=external-tvbox-token&adFilter=true')
  );
  const api = (await subscription.json()).sites[0].api as string;
  expect(new URL(api).searchParams.get('tvboxToken')).toBe(
    'external-tvbox-token'
  );
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        list: [
          {
            vod_play_from: 'fixture',
            vod_play_url: '正片$https://cdn.test/master.m3u8?sig=original',
          },
        ],
      })
    )
  );
  const catalog = await cmsProxy(new NextRequest(api));
  expect(catalog.status).toBe(200);
  const upstreamRequest = new URL(fetchMock.mock.calls[0][0]);
  expect(upstreamRequest.searchParams.has('tvboxToken')).toBe(false);
  expect(upstreamRequest.searchParams.get('sourceKey')).toBe('upstream-secret');
  const playUrl = (await catalog.json()).list[0].vod_play_url.split(
    '$'
  )[1] as string;
  const masterUrl = new URL(playUrl);
  expect(masterUrl.searchParams.get('tvboxToken')).toBe('external-tvbox-token');
  masterUrl.searchParams.set('adblock', 'false');
  masterUrl.searchParams.set('proxySegments', 'true');
  fetchMock.mockResolvedValueOnce(
    new Response(
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nchild.m3u8?sig=child',
      { headers: { 'content-type': 'application/vnd.apple.mpegurl' } }
    )
  );
  const master = await m3u8Proxy(new NextRequest(masterUrl));
  const childUrl =
    (await master.text())
      .split('\n')
      .find((line) => line.startsWith('https://')) || '';
  expect(new URL(childUrl).searchParams.get('tvboxToken')).toBe(
    'external-tvbox-token'
  );
  fetchMock.mockResolvedValueOnce(
    new Response(
      '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:10,\npart.ts',
      { headers: { 'content-type': 'application/vnd.apple.mpegurl' } }
    )
  );
  const child = await m3u8Proxy(new NextRequest(childUrl));
  const playlist = await child.text();
  const keyUrl = playlist.match(/URI="([^"]+)"/)?.[1] || '';
  const partUrl =
    playlist.split('\n').find((line) => line.startsWith('https://')) || '';
  for (const url of [keyUrl, partUrl]) {
    expect(new URL(url).pathname).toBe('/api/proxy/vod/segment');
    expect(new URL(url).searchParams.get('tvboxToken')).toBe(
      'external-tvbox-token'
    );
  }
  fetchMock.mockResolvedValueOnce(
    new Response('media-bytes', { headers: { 'content-type': 'video/mp2t' } })
  );
  const segment = await segmentProxy(new NextRequest(partUrl));
  expect(segment.status).toBe(200);
  expect(await segment.text()).toBe('media-bytes');
});

it('rejects disabled, unknown or banned TVBox tokens and limits CMS to the user source allowlist', async () => {
  expect(
    (await m3u8Proxy(request(`${m3u8Path}&tvboxToken=unknown`))).status
  ).toBe(401);
  (db.getUsernameByTvboxToken as jest.Mock).mockResolvedValue('alice');
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue({ banned: true });
  expect(
    (await cmsProxy(request(`${cmsPath}&tvboxToken=user-token`))).status
  ).toBe(401);
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue({ banned: false });
  const disallowed = `/api/cms-proxy?api=${encodeURIComponent(
    'https://private.test/api'
  )}&tvboxToken=user-token`;
  expect((await cmsProxy(request(disallowed))).status).toBe(401);
  process.env.ENABLE_TVBOX_SUBSCRIBE = 'false';
  expect(
    (await m3u8Proxy(request(`${m3u8Path}&tvboxToken=external-tvbox-token`)))
      .status
  ).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('retains explicitly configured legacy proxy-token access and still enforces network safety', async () => {
  process.env.NEXT_PUBLIC_PROXY_M3U8_TOKEN = 'legacy-token';
  expect((await m3u8Proxy(request(`${m3u8Path}&token=wrong`))).status).toBe(
    401
  );
  fetchMock.mockResolvedValueOnce(
    new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nchild.m3u8')
  );
  const response = await m3u8Proxy(request(`${m3u8Path}&token=legacy-token`));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('&token=legacy-token');
  (validateProxyUrlServerSide as jest.Mock).mockResolvedValueOnce(false);
  expect(
    (await m3u8Proxy(request(`${m3u8Path}&token=legacy-token`))).status
  ).toBe(403);
});

it.each([
  [openlistPlay, { token: 'proxy' }],
  [openlistStream, { token: 'proxy', filename: 'video.mp4' }],
  [embyPlay, { token: 'proxy', filename: 'video.mp4' }],
  [embySubtitle, { token: 'proxy', filename: 'subtitle.vtt' }],
])(
  'requires a real session or legitimate TVBox token for a private media route',
  async (handler, params) => {
    const run = handler as (
      request: NextRequest,
      context: { params: Promise<{ token: string; filename: string }> }
    ) => Promise<Response>;
    const context = {
      params: Promise.resolve({ filename: 'video.mp4', ...params }),
    };
    const forged = encodeURIComponent(
      JSON.stringify({ username: 'alice', role: 'owner' })
    );
    expect((await run(request('/api/private'), context)).status).toBe(401);
    expect((await run(request('/api/private', forged), context)).status).toBe(
      401
    );
    expect(getConfig).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    // Missing media parameters produce 400 only after authentication has succeeded.
    expect(
      (await run(request('/api/private', signedCookie()), context)).status
    ).toBe(400);
    expect(
      (
        await run(request('/api/private'), {
          params: Promise.resolve({
            filename: 'video.mp4',
            ...params,
            token: 'external-tvbox-token',
          }),
        })
      ).status
    ).toBe(400);
  }
);

it('does not authorize private Emby images with a forged cookie or disclose global tokens in website URLs', async () => {
  const forged = encodeURIComponent(
    JSON.stringify({ username: 'alice', role: 'owner' })
  );
  expect(
    (
      await embyImage(request('/api/emby/image/proxy/1', forged), {
        params: Promise.resolve({ token: 'proxy', itemId: '1' }),
      })
    ).status
  ).toBe(401);
  expect(getConfig).not.toHaveBeenCalled();
  expect(await getProxyToken(request('/api/search', signedCookie()))).toBe(
    'proxy'
  );
  expect(await getProxyToken(request('/api/search', forged))).toBeNull();
  expect(await getProxyToken()).toBeNull();
});

it('prefers the server-only proxy token and rejects empty configuration', async () => {
  process.env.PROXY_M3U8_TOKEN = 'server-only-token';
  process.env.NEXT_PUBLIC_PROXY_M3U8_TOKEN = 'old-token';
  expect((await m3u8Proxy(request(`${m3u8Path}&token=old-token`))).status).toBe(
    401
  );
  fetchMock.mockResolvedValueOnce(
    new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2000000\nchild.m3u8')
  );
  expect(
    (await m3u8Proxy(request(`${m3u8Path}&token=server-only-token`))).status
  ).toBe(200);
  process.env.PROXY_M3U8_TOKEN = ' ';
  expect((await m3u8Proxy(request(`${m3u8Path}&token=%20`))).status).toBe(401);
});
