'use strict';

/*
 * 房间权限（参照 SyncTV 的“角色默认权限 + 单个成员增减”）。
 *
 * - 房主：全部权限，另外只有房主能删除房间、转让房主、设置管理员。
 * - 管理员：除房主专属操作外的全部权限。
 * - 成员：房间设置里的“成员默认权限”，可以对单个成员再增减。
 */

const PERMISSIONS = Object.freeze({
  /** 播放、暂停、拖动、倍速 */
  PLAYBACK: 'playback',
  /** 换片、换集、上一个/下一个、停止放映 */
  CHANGE_MEDIA: 'changeMedia',
  /** 往片单添加影片 */
  ADD_MEDIA: 'addMedia',
  /** 调整片单顺序、移除别人添加的影片、清空片单 */
  MANAGE_PLAYLIST: 'managePlaylist',
  /** 发送聊天 */
  CHAT: 'chat',
  /** 踢出成员、审核加入申请、调整成员权限、删除别人的消息 */
  MANAGE_MEMBERS: 'manageMembers',
  /** 修改房间名称、简介、封面和设置 */
  EDIT_ROOM: 'editRoom',
});

const ALL = Object.freeze(Object.values(PERMISSIONS));
const ADMIN_DEFAULT = ALL;
/** 新房间的成员默认权限：与 SyncTV 默认一致，成员可以一起控制、添加和聊天。 */
const MEMBER_DEFAULT = Object.freeze([
  PERMISSIONS.PLAYBACK,
  PERMISSIONS.CHANGE_MEDIA,
  PERMISSIONS.ADD_MEDIA,
  PERMISSIONS.CHAT,
]);

function normalizePermissions(value, fallback = MEMBER_DEFAULT) {
  if (!Array.isArray(value)) return [...fallback];
  return ALL.filter((permission) => value.includes(permission));
}

/** 旧房间只有两个开关：换算成成员默认权限。 */
function memberDefaults(settings = {}) {
  if (Array.isArray(settings.memberPermissions))
    return normalizePermissions(settings.memberPermissions);
  const result = [PERMISSIONS.CHAT];
  if (settings.memberCanControl !== false)
    result.push(PERMISSIONS.PLAYBACK, PERMISSIONS.CHANGE_MEDIA);
  if (settings.memberCanQueue !== false) result.push(PERMISSIONS.ADD_MEDIA);
  return normalizePermissions(result);
}

function parseOverride(json) {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? normalizePermissions(value) : null;
  } catch {
    return null;
  }
}

/** room、membership（数据库行）-> { role, permissions } */
function effective(room, accountId, membership) {
  if (!accountId || !membership) return { role: 'none', permissions: [] };
  if (room.ownerAccountId === accountId)
    return { role: 'owner', permissions: [...ALL] };
  const override = parseOverride(membership.permissions_json);
  if (membership.can_host)
    return { role: 'admin', permissions: override || [...ADMIN_DEFAULT] };
  return {
    role: 'member',
    permissions: override || memberDefaults(room.settings),
  };
}

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS: ALL,
  MEMBER_DEFAULT,
  normalizePermissions,
  memberDefaults,
  effective,
};
