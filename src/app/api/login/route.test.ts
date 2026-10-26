/** @jest-environment ./src/test/node-web-environment.cjs */
const mockGetUserInfoV2 = jest.fn();
const mockVerifyUserV2 = jest.fn();

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(async () => ({ SiteConfig: {} })),
}));
jest.mock('@/lib/db', () => ({
  db: {
    getUserInfoV2: (...args: unknown[]) => mockGetUserInfoV2(...args),
    verifyUserV2: (...args: unknown[]) => mockVerifyUserV2(...args),
  },
}));
jest.mock('@/lib/refresh-token', () => ({
  generateRefreshToken: jest.fn(),
  generateTokenId: jest.fn(),
  storeRefreshToken: jest.fn(),
  TOKEN_CONFIG: {},
}));

import { NextRequest } from 'next/server';

process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
process.env.USERNAME = 'boss';
process.env.PASSWORD = 'boss-password';

// 路由在加载时就读取存储类型，必须先设环境变量再加载
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('./route') as typeof import('./route');

function login(body: Record<string, unknown>, ip = '203.0.113.30') {
  return POST(
    new NextRequest('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  delete (globalThis as { __loginFail2BanStore?: unknown })
    .__loginFail2BanStore;
  delete (globalThis as { __loginAccountLocks?: unknown }).__loginAccountLocks;
  delete (globalThis as { __loginTrustedIps?: unknown }).__loginTrustedIps;
  mockGetUserInfoV2.mockResolvedValue(null);
});

test('spaces around the username (common from phone keyboards) are ignored', async () => {
  const res = await login({ username: '  alice  ', password: 'x' });
  expect(res.status).toBe(401);
  expect(mockGetUserInfoV2).toHaveBeenCalledWith('alice');
  const data = await res.json();
  expect(data.error).toBe('用户名或密码错误');
});

test('after five failures the answer says how long to wait, and other IPs still get through', async () => {
  for (let i = 0; i < 5; i++) {
    // 每次换一个用户名，避免先触发"按账号锁定"
    await login({ username: `user${i}`, password: 'x' }, '203.0.113.31');
  }
  const blocked = await login(
    { username: 'user9', password: 'x' },
    '203.0.113.31'
  );
  expect(blocked.status).toBe(429);
  const data = await blocked.json();
  expect(data.error).toBe('登录失败次数过多，请 15 分钟后再试');
  expect(data.retryAfterSeconds).toBeGreaterThan(14 * 60);
  expect(blocked.headers.get('Retry-After')).toBeTruthy();

  const other = await login(
    { username: 'user9', password: 'x' },
    '203.0.113.32'
  );
  expect(other.status).toBe(401);
});

test('a forged CF-Connecting-IP cannot ban or hide behind someone else address', async () => {
  const forged = (ip: string) =>
    POST(
      new NextRequest('http://localhost/api/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-real-ip': '203.0.113.40',
          'cf-connecting-ip': ip,
        },
        body: JSON.stringify({ username: 'nobody', password: 'x' }),
      })
    );
  // 每次伪造不同的来源 IP：真实地址 203.0.113.40 仍然累计失败并被封
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++)
    statuses.push((await forged(`1.1.1.${i}`)).status);
  expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
  expect(statuses[5]).toBe(429);
});
