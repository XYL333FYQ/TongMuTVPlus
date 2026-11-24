/**
 * 服务器接口的权限检查只有这一处（STANDARD.md 公共零件“服务器权限”）。
 *
 * - 角色每次按服务器的用户表判断，不信 Cookie 里写的角色：管理员被降级或封禁后，
 *   手里还没过期的登录立刻失去管理权限。站长只认环境变量 USERNAME。
 * - 本地存储模式（NEXT_PUBLIC_STORAGE_TYPE=localstorage）没有用户表，只有站长。
 * - 没登录或登录失效：401 { error: 'Unauthorized' }。这个词是给前端看的暗号，
 *   TokenRefreshManager 和 db.client 靠它决定自动续登录，不能换成别的字。
 */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from './auth';
import { type RoleLevel, ROLE_RANK as RANK } from './roles';

export type { RoleLevel };

type UserRow = NonNullable<
  Awaited<ReturnType<typeof import('./db')['db']['getUserInfoV2']>>
>;

export type Caller = {
  username: string;
  role: RoleLevel;
  /** 用户表里的这一行；站长不查表，是 null */
  info: UserRow | null;
};

/**
 * 一个账号在权限上算什么角色——全站只有这一条规则（接口权限、功能权限都用它）：
 * 站长只认环境变量 USERNAME；用户表里写着 owner 但名字不是 USERNAME 的，算普通成员。
 */
export function roleOf(
  username: string,
  info: { role?: string } | null
): RoleLevel {
  if (username === process.env.USERNAME) return 'owner';
  return info?.role === 'admin' ? 'admin' : 'user';
}

/** 管理员和站长：不受功能开关、用户组限制 */
export function isPrivileged(role: RoleLevel): boolean {
  return RANK[role] >= RANK.admin;
}

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * 通过时返回来访者，拒绝时返回要直接回给前端的响应。
 * deniedStatus：已登录但被拒绝（用户不存在、被封禁、角色不够）时用的状态码；
 * 不传时角色不够是 403，其余是 401。接口原来是什么状态码就传什么，前端判断不受影响。
 */
export async function requireRole(
  request: NextRequest,
  level: RoleLevel,
  options: { deniedStatus?: 401 | 403 } = {}
): Promise<Caller | NextResponse> {
  const authInfo = getAuthInfoFromCookie(request);
  const username = authInfo?.username;
  if (!username) return refuse('Unauthorized', 401);

  if (username === process.env.USERNAME)
    return { username, role: 'owner', info: null };

  const status = options.deniedStatus;
  // 只有站长能做的事：不是站长就不用再查用户表
  if (level === 'owner') return refuse('没有权限', status ?? 403);
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  )
    return refuse('用户不存在', status ?? 401);

  const { db } = await import('./db');
  const info = await db.getUserInfoV2(username);
  if (!info) return refuse('用户不存在', status ?? 401);
  if (info.banned) return refuse('账号已被封禁', status ?? 401);

  const role = roleOf(username, info);
  if (RANK[role] < RANK[level]) return refuse('没有权限', status ?? 403);
  return { username, role, info };
}

export function isCaller(value: Caller | NextResponse): value is Caller {
  return !(value instanceof NextResponse);
}

/** 管理员能进、但只有站长能做的那一步（开关全站功能、改功能授权等） */
export function isOwner(caller: Caller): boolean {
  return caller.role === 'owner';
}
