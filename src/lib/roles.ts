/**
 * “这个角色算什么”的唯一判断（STANDARD.md 公共零件“服务器权限”）。
 *
 * 站点角色（用户表、登录 Cookie 里的 owner / admin / user）和房间角色
 * （owner / admin / member）用的是同一组词，页面和接口要按角色显示或放行时都调这里，
 * 不自己写 role === 'owner'。接口的放行和拒绝走 require-role.ts 的 requireRole()，
 * 它也从这里取角色等级。
 *
 * 这里只看“写着什么角色”。账号在权限上到底算不算站长（只认环境变量 USERNAME）由
 * require-role.ts 的 roleOf() 决定；本文件不引用服务端代码，页面可以直接用。
 */

export type RoleLevel = 'owner' | 'admin' | 'user';

type RoleValue = string | null | undefined;

/** 角色等级：数字越大权限越高；不认识的角色（user、member、none、没登录）都是 0 */
export const ROLE_RANK: Record<RoleLevel, number> = {
  user: 0,
  admin: 1,
  owner: 2,
};

export function rankOf(role: RoleValue): number {
  return role === 'owner' || role === 'admin' ? ROLE_RANK[role] : 0;
}

/** 站长（房间里是房主） */
export function isOwnerRole(role: RoleValue): boolean {
  return role === 'owner';
}

/** 正好是管理员（不含站长） */
export function isAdminRole(role: RoleValue): boolean {
  return role === 'admin';
}

/** 管理员或站长 */
export function isPrivilegedRole(role: RoleValue): boolean {
  return rankOf(role) >= ROLE_RANK.admin;
}
