/** @jest-environment ./src/test/node-web-environment.cjs */

import { NextRequest } from 'next/server';
import { createHmac, webcrypto } from 'node:crypto';

import { config, middleware } from '@/middleware';

import { authenticateAuthInfo, authenticateRequest } from './request-auth';
import { TOKEN_CONFIG } from './token-config';

function signedCookie(timestamp = Date.now()) {
  const data = { username: 'alice', role: 'user', timestamp };
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

function request(path: string, cookie?: string) {
  return new NextRequest(`https://tongmu.test${path}`, {
    headers: cookie ? { cookie: `auth=${cookie}` } : {},
  });
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
});
beforeEach(() => {
  process.env.PASSWORD = 'test-secret';
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'sqlite';
});

describe('real request authentication and guest boundary', () => {
  it('applies the same signature check to server-rendered layout cookies', async () => {
    expect(
      await authenticateAuthInfo({ username: 'alice', role: 'owner' })
    ).toBeNull();
    const signed = JSON.parse(decodeURIComponent(signedCookie()));
    expect((await authenticateAuthInfo(signed))?.username).toBe('alice');
  });
  it('accepts a current signed session but rejects a parsed username, tampered role and expired signature', async () => {
    expect(
      (await authenticateRequest(request('/api/search', signedCookie())))
        ?.username
    ).toBe('alice');
    const forged = encodeURIComponent(
      JSON.stringify({ username: 'alice', role: 'owner' })
    );
    expect(
      await authenticateRequest(request('/api/search', forged))
    ).toBeNull();
    const tampered = JSON.parse(decodeURIComponent(signedCookie()));
    tampered.role = 'owner';
    expect(
      await authenticateRequest(
        request('/api/search', encodeURIComponent(JSON.stringify(tampered)))
      )
    ).toBeNull();
    expect(
      await authenticateRequest(
        request(
          '/api/search',
          signedCookie(Date.now() - TOKEN_CONFIG.ACCESS_TOKEN_AGE - 1000)
        )
      )
    ).toBeNull();
  });

  it('checks the shared password in localstorage mode and fails closed when unconfigured', async () => {
    process.env.NEXT_PUBLIC_STORAGE_TYPE = 'localstorage';
    expect(
      await authenticateRequest(
        request(
          '/api/search',
          encodeURIComponent(JSON.stringify({ password: 'wrong' }))
        )
      )
    ).toBeNull();
    expect(
      await authenticateRequest(
        request(
          '/api/search',
          encodeURIComponent(JSON.stringify({ password: 'test-secret' }))
        )
      )
    ).not.toBeNull();
    delete process.env.PASSWORD;
    expect(
      await authenticateRequest(request('/api/search', signedCookie()))
    ).toBeNull();
  });

  it.each([
    '/',
    '/douban',
    '/search?q=电影',
    '/about',
    '/watch-room',
    '/brand/tm-mark.svg',
    '/api/public/catalog?q=电影',
    '/api/rooms?mode=public',
  ])('allows the explicit guest entry %s', async (path) => {
    const response = await middleware(request(path));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each([
    '/api/search?q=电影',
    '/api/detail?source=fixture&id=1',
    '/api/source-detail?source=fixture',
    '/api/proxy/m3u8?url=https://cdn.test/a.m3u8',
    '/api/rooms?mode=private',
    '/api/admin/config',
    '/api/openlist/play?folder=private',
    '/api/emby/sources',
  ])(
    'blocks anonymous and forged-cookie access to %s and preserves signed sessions',
    async (path) => {
      expect((await middleware(request(path))).status).toBe(401);
      expect(
        (
          await middleware(
            request(
              path,
              encodeURIComponent(
                JSON.stringify({ username: 'alice', role: 'owner' })
              )
            )
          )
        ).status
      ).toBe(401);
      expect(
        (await middleware(request(path, signedCookie()))).headers.get(
          'x-middleware-next'
        )
      ).toBe('1');
    }
  );

  it('preserves a site-internal playback destination through login', async () => {
    const response = await middleware(
      request('/play?title=测试影片&year=2025')
    );
    const location = new URL(response.headers.get('location') || '');
    expect(location.origin).toBe('https://tongmu.test');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('returnTo')).toBe(
      '/play?title=%E6%B5%8B%E8%AF%95%E5%BD%B1%E7%89%87&year=2025'
    );
    expect(location.searchParams.get('redirect')).toBe(
      location.searchParams.get('returnTo')
    );
  });

  it('keeps private base APIs in middleware and delegates only token-enabled media paths to route authentication', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test('/api/openlist/play')).toBe(true);
    expect(matcher.test('/api/emby/sources')).toBe(true);
    expect(matcher.test('/api/openlist/play/external-token')).toBe(false);
    expect(matcher.test('/api/emby/image/external-token/1')).toBe(false);
  });
});
