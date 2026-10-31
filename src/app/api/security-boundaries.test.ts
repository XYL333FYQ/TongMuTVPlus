/** @jest-environment ./src/test/node-web-environment.cjs */
// 安全边界：登录凭证脚本读不到、跨站改数据被拒、站长重置只能本站发起、
// 转码助手只拿到短效凭证、注册邀请码不能被挨个试、订阅地址只认 http(s)。
const mockGetUserInfoV2 = jest.fn();
const mockResetConfig = jest.fn();
const mockClearConfigCache = jest.fn();
let mockSiteConfig: Record<string, unknown> = {};

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({ SiteConfig: mockSiteConfig })),
  resetConfig: (...args: unknown[]) => mockResetConfig(...args),
  clearConfigCache: (...args: unknown[]) => mockClearConfigCache(...args),
}));
jest.mock('@/lib/db', () => ({
  db: {
    getUserInfoV2: (...args: unknown[]) => mockGetUserInfoV2(...args),
    verifyUserV2: jest.fn(),
    checkUserExist: jest.fn(async () => false),
  },
}));
jest.mock('@/lib/refresh-token', () => ({
  generateRefreshToken: () => 'refresh-secret-value',
  generateTokenId: () => 'token-1',
  storeRefreshToken: jest.fn(),
  TOKEN_CONFIG: {},
}));
jest.mock('@/lib/request-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/tv-mode', () => ({
  isTVModeEnabled: () => true,
  resolveLoginPath: () => '/login',
}));

import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
process.env.USERNAME = 'boss';
process.env.PASSWORD = 'boss-password';

/* eslint-disable @typescript-eslint/no-var-requires */
const login = require('./login/route') as typeof import('./login/route');
const reset =
  require('./admin/reset/route') as typeof import('./admin/reset/route');
const reload =
  require('./admin/reload/route') as typeof import('./admin/reload/route');
const transcoder =
  require('./auth/transcoder-cookie/route') as typeof import('./auth/transcoder-cookie/route');
const register =
  require('./register/route') as typeof import('./register/route');
const subscription =
  require('./admin/config_subscription/fetch/route') as typeof import('./admin/config_subscription/fetch/route');
const { middleware } =
  require('../../middleware') as typeof import('../../middleware');
/* eslint-enable @typescript-eslint/no-var-requires */

function setCookies(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  return headers.getSetCookie
    ? headers.getSetCookie()
    : (response.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/);
}

function ownerCookie(extra: Record<string, unknown> = {}) {
  return encodeURIComponent(
    JSON.stringify({
      username: 'boss',
      role: 'owner',
      timestamp: Date.now(),
      tokenId: 'token-1',
      refreshToken: 'refresh-secret-value',
      refreshExpires: Date.now() + 1000000,
      signature: 'a'.repeat(64),
      ...extra,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSiteConfig = {};
  delete (globalThis as { __loginFail2BanStore?: unknown })
    .__loginFail2BanStore;
  delete (globalThis as { __loginAccountLocks?: unknown }).__loginAccountLocks;
});

test('login stores the credential out of reach of page scripts and exposes only display fields', async () => {
  const response = await login.POST(
    new NextRequest('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '1.2.3.4' },
      body: JSON.stringify({ username: 'boss', password: 'boss-password' }),
    })
  );
  expect(response.status).toBe(200);
  const cookies = setCookies(response);
  const auth = cookies.find((c) => c.startsWith('auth='));
  const info = cookies.find((c) => c.startsWith('auth_info='));
  expect(auth).toMatch(/HttpOnly/i);
  expect(info).toBeTruthy();
  expect(info).not.toMatch(/HttpOnly/i);
  const display = decodeURIComponent(
    (info as string).split(';')[0].slice('auth_info='.length)
  );
  expect(JSON.parse(display)).toMatchObject({
    username: 'boss',
    role: 'owner',
  });
  expect(display).not.toMatch(/signature|refreshToken|refresh-secret|password/);
});

test('logout clears both cookies', async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const logout = require('./logout/route') as typeof import('./logout/route');
  const response = await logout.POST(
    new NextRequest('http://localhost/api/logout', { method: 'POST' })
  );
  const cookies = setCookies(response);
  for (const name of ['auth', 'auth_info']) {
    const cookie = cookies.find((c) => c.startsWith(name + '='));
    expect(cookie).toBeTruthy();
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  }
});

test('requests other sites make the browser send cannot change data', async () => {
  const crossSite = await middleware(
    new NextRequest('https://tongmu.test/api/favorites', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
    })
  );
  expect(crossSite.status).toBe(403);
  // 本站页面自己发的、App 发的（没有这个头）照常走登录校验
  for (const headers of [
    { 'sec-fetch-site': 'same-origin' },
    {} as Record<string, string>,
  ]) {
    const response = await middleware(
      new NextRequest('https://tongmu.test/api/favorites', {
        method: 'POST',
        headers,
      })
    );
    expect(response.status).toBe(401);
  }
});

test('config reset and reload: POST for the page, GET only when not from another site', async () => {
  const cookie = 'auth=' + ownerCookie();
  for (const route of [reset, reload]) {
    const crossSite = await route.GET(
      new NextRequest('https://tongmu.test/api/admin/x', {
        headers: { cookie, 'sec-fetch-site': 'cross-site' },
      })
    );
    expect(crossSite.status).toBe(403);
    const post = await route.POST(
      new NextRequest('https://tongmu.test/api/admin/x', {
        method: 'POST',
        headers: { cookie, 'sec-fetch-site': 'same-origin' },
      })
    );
    expect(post.status).toBe(200);
  }
  expect(mockResetConfig).toHaveBeenCalledTimes(1);
  expect(mockClearConfigCache).toHaveBeenCalledTimes(1);
  const notOwner = await reset.POST(
    new NextRequest('https://tongmu.test/api/admin/reset', {
      method: 'POST',
      headers: { cookie: 'auth=' + ownerCookie({ username: 'alice' }) },
    })
  );
  expect(notOwner.status).toBe(401);
});

test('the local transcoder gets a short-lived copy that cannot renew the login', async () => {
  const crossSite = await transcoder.POST(
    new NextRequest('https://tongmu.test/api/auth/transcoder-cookie', {
      method: 'POST',
      headers: {
        cookie: 'auth=' + ownerCookie(),
        'sec-fetch-site': 'cross-site',
      },
    })
  );
  expect(crossSite.status).toBe(403);
  const anonymous = await transcoder.POST(
    new NextRequest('https://tongmu.test/api/auth/transcoder-cookie', {
      method: 'POST',
    })
  );
  expect(anonymous.status).toBe(401);
  const response = await transcoder.POST(
    new NextRequest('https://tongmu.test/api/auth/transcoder-cookie', {
      method: 'POST',
      headers: { cookie: 'auth=' + ownerCookie() },
    })
  );
  expect(response.headers.get('cache-control')).toBe('no-store');
  const { cookie } = await response.json();
  const copy = JSON.parse(decodeURIComponent(cookie.slice('auth='.length)));
  expect(copy.refreshToken).toBe('transcoder');
  expect(copy.signature).toBe('a'.repeat(64));
  expect(copy.username).toBe('boss');
  expect(JSON.stringify(copy)).not.toContain('refresh-secret-value');
});

test('wrong invite codes count toward the shared per-IP limit', async () => {
  mockSiteConfig = {
    EnableRegistration: true,
    RequireRegistrationInviteCode: true,
    RegistrationInviteCode: 'right-code',
  };
  const attempt = () =>
    register.POST(
      new NextRequest('https://tongmu.test/api/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '198.51.100.7',
        },
        body: JSON.stringify({
          username: 'newbie',
          password: 'secret-123',
          confirmPassword: 'secret-123',
          inviteCode: 'guess',
        }),
      })
    );
  for (let i = 0; i < 5; i++) {
    expect((await attempt()).status).toBe(400);
  }
  const blocked = await attempt();
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get('Retry-After')).toBeTruthy();
});

test('config subscription only fetches http(s) addresses', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch');
  try {
    for (const url of [
      'file:///etc/passwd',
      'data:text/plain,x',
      'not a url',
    ]) {
      const response = await subscription.POST(
        new NextRequest(
          'https://tongmu.test/api/admin/config_subscription/fetch',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              cookie: 'auth=' + ownerCookie(),
            },
            body: JSON.stringify({ url }),
          }
        )
      );
      expect(response.status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});
