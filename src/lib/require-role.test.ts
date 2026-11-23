/** @jest-environment ./src/test/node-web-environment.cjs */
import { NextRequest, NextResponse } from 'next/server';

import { isCaller, isOwner, requireRole } from './require-role';

const USERS: Record<string, { role: string; banned: boolean } | undefined> = {
  alice: { role: 'user', banned: false },
  bob: { role: 'user', banned: true },
  carol: { role: 'admin', banned: false },
  dave: { role: 'user', banned: false }, // 刚被降级，手里的 Cookie 还写着 admin
};
const getUserInfoV2 = jest.fn(async (name: string) => USERS[name] ?? null);
jest.mock('@/lib/db', () => ({
  db: { getUserInfoV2: (name: string) => getUserInfoV2(name) },
}));

const ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ENV, USERNAME: 'boss', NEXT_PUBLIC_STORAGE_TYPE: 'd1' };
  getUserInfoV2.mockClear();
});
afterAll(() => {
  process.env = ENV;
});

function request(username?: string, role = 'user') {
  const headers: Record<string, string> = {};
  if (username)
    headers.cookie =
      'auth=' +
      encodeURIComponent(
        JSON.stringify({ username, role, timestamp: Date.now() })
      );
  return new NextRequest('https://tongmu.test/api/x', { headers });
}

async function refusal(result: Awaited<ReturnType<typeof requireRole>>) {
  expect(isCaller(result)).toBe(false);
  const response = result as NextResponse;
  return { status: response.status, body: await response.json() };
}

test('anonymous gets 401 with the Unauthorized signal the client refreshes on', async () => {
  expect(await refusal(await requireRole(request(), 'user'))).toEqual({
    status: 401,
    body: { error: 'Unauthorized' },
  });
  // 角色拒绝改成 403 的接口，没登录也照样 401
  expect(
    await refusal(await requireRole(request(), 'admin', { deniedStatus: 403 }))
  ).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  expect(getUserInfoV2).not.toHaveBeenCalled();
});

test('a user missing from the user table gets 401 用户不存在', async () => {
  expect(await refusal(await requireRole(request('ghost'), 'user'))).toEqual({
    status: 401,
    body: { error: '用户不存在' },
  });
});

test('banned member gets 401 账号已被封禁', async () => {
  expect(await refusal(await requireRole(request('bob'), 'user'))).toEqual({
    status: 401,
    body: { error: '账号已被封禁' },
  });
  expect(
    await refusal(
      await requireRole(request('bob'), 'admin', { deniedStatus: 403 })
    )
  ).toEqual({ status: 403, body: { error: '账号已被封禁' } });
});

test('member asking for admin gets 403 没有权限, or 401 when deniedStatus is 401', async () => {
  expect(await refusal(await requireRole(request('alice'), 'admin'))).toEqual({
    status: 403,
    body: { error: '没有权限' },
  });
  expect(
    await refusal(
      await requireRole(request('alice'), 'admin', { deniedStatus: 401 })
    )
  ).toEqual({ status: 401, body: { error: '没有权限' } });
});

test('a cookie that still says admin is refused after the user was demoted', async () => {
  expect(
    await refusal(await requireRole(request('dave', 'admin'), 'admin'))
  ).toEqual({ status: 403, body: { error: '没有权限' } });
  // 反过来 Cookie 写着 owner 也不算站长
  expect(
    await refusal(await requireRole(request('carol', 'owner'), 'owner'))
  ).toEqual({ status: 403, body: { error: '没有权限' } });
});

test('owner passes every level without a user-table lookup', async () => {
  for (const level of ['owner', 'admin', 'user'] as const) {
    const result = await requireRole(request('boss', 'owner'), level);
    expect(isCaller(result)).toBe(true);
    expect(result).toEqual({ username: 'boss', role: 'owner', info: null });
  }
  expect(getUserInfoV2).not.toHaveBeenCalled();
});

test('owner passes every level, also in localstorage mode', async () => {
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'localstorage';
  for (const level of ['owner', 'admin', 'user'] as const) {
    expect(isCaller(await requireRole(request('boss', 'owner'), level))).toBe(
      true
    );
  }
  // 本地存储模式没有用户表：站长以外的人都不存在
  expect(await refusal(await requireRole(request('alice'), 'user'))).toEqual({
    status: 401,
    body: { error: '用户不存在' },
  });
  expect(getUserInfoV2).not.toHaveBeenCalled();
});

test('admin passes admin and user, not owner', async () => {
  const admin = await requireRole(request('carol', 'admin'), 'admin');
  expect(isCaller(admin)).toBe(true);
  expect(admin).toMatchObject({ username: 'carol', role: 'admin' });
  expect(isCaller(await requireRole(request('carol'), 'user'))).toBe(true);
  expect(
    await refusal(await requireRole(request('carol', 'admin'), 'owner'))
  ).toEqual({ status: 403, body: { error: '没有权限' } });
});

test('member passes user level and carries the user-table row', async () => {
  const member = await requireRole(request('alice'), 'user');
  expect(member).toEqual({
    username: 'alice',
    role: 'user',
    info: { role: 'user', banned: false },
  });
});

test('isOwner tells the owner from an admin', async () => {
  const owner = await requireRole(request('boss', 'owner'), 'admin');
  const admin = await requireRole(request('carol', 'admin'), 'admin');
  expect(isCaller(owner) && isOwner(owner)).toBe(true);
  expect(isCaller(admin) && isOwner(admin)).toBe(false);
});

test('an owner-only check refuses everyone else without reading the user table', async () => {
  for (const name of ['alice', 'bob', 'carol', 'ghost']) {
    expect(
      await refusal(
        await requireRole(request(name, 'owner'), 'owner', {
          deniedStatus: 401,
        })
      )
    ).toEqual({ status: 401, body: { error: '没有权限' } });
  }
  expect(getUserInfoV2).not.toHaveBeenCalled();
});
