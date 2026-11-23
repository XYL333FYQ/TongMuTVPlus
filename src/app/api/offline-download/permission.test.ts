/** @jest-environment ./src/test/node-web-environment.cjs */
// 离线下载开着的时候谁能用：没登录 401（前端会自动续登录），成员 403，管理员 / 站长放行。
// 角色按用户表，不信 Cookie 里写的角色。
process.env.NEXT_PUBLIC_ENABLE_OFFLINE_DOWNLOAD = 'true';
process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
process.env.USERNAME = 'boss';

const USERS: Record<string, { role: string; banned: boolean }> = {
  alice: { role: 'user', banned: false },
  carol: { role: 'admin', banned: false },
};
jest.mock('@/lib/db', () => ({
  db: { getUserInfoV2: async (name: string) => USERS[name] ?? null },
}));

import { NextRequest } from 'next/server';

function request(username?: string, role = 'user') {
  const headers: Record<string, string> = {};
  if (username)
    headers.cookie =
      'auth=' +
      encodeURIComponent(
        JSON.stringify({ username, role, timestamp: Date.now() })
      );
  // 缺参数：通过权限检查的请求会得到 400，被拦下的不会走到这一步
  return new NextRequest('https://tongmu.test/api/offline-download/local', {
    headers,
  });
}

async function outcome(username?: string, role?: string) {
  // 开关在模块加载时读环境变量，所以等上面设好再加载
  const { GET } = await import('./local/route');
  const response = await GET(request(username, role));
  return { status: response.status, body: await response.json() };
}

test('signed-out callers get 401 Unauthorized so the client refreshes the login', async () => {
  expect(await outcome()).toEqual({
    status: 401,
    body: { error: 'Unauthorized' },
  });
});

test('a member is refused even with a cookie that says admin', async () => {
  expect(await outcome('alice', 'admin')).toEqual({
    status: 403,
    body: { error: '没有权限' },
  });
});

test('admin and owner pass the permission check', async () => {
  expect((await outcome('carol', 'admin')).status).toBe(400);
  expect((await outcome('boss', 'owner')).status).toBe(400);
});
