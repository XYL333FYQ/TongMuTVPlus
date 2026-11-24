/*
 * 创建房间 / 房间设置表单的值：成员权限的说明、默认值、从房间读出当前值。
 */

import type {
  Room,
  RoomAutoPlayMode,
  RoomPermission,
} from '@/types/watch-room';

export const MEMBER_PERMISSION_LABELS: Array<{
  id: RoomPermission;
  label: string;
  hint: string;
}> = [
  { id: 'playback', label: '控制播放', hint: '播放、暂停、拖动、倍速' },
  { id: 'changeMedia', label: '换片换集', hint: '放另一部、切换集数' },
  { id: 'addMedia', label: '添加片单', hint: '往待看片单里加影片' },
  { id: 'managePlaylist', label: '管理片单', hint: '调整顺序、移除别人加的' },
  { id: 'chat', label: '聊天', hint: '发送消息和弹幕' },
  { id: 'voice', label: '语音发言', hint: '开麦克风说话，听别人说话不需要' },
];

export interface RoomFormValues {
  name: string;
  description: string;
  isPublic: boolean;
  /** 空字符串：不设密码；undefined：不修改 */
  password?: string;
  requireApproval: boolean;
  maxMembers: number;
  chatEnabled: boolean;
  waitForBuffering: boolean;
  autoPlay: { enabled: boolean; mode: RoomAutoPlayMode };
  memberPermissions: RoomPermission[];
}

export function defaultRoomValues(name: string): RoomFormValues {
  return {
    name,
    description: '',
    isPublic: false,
    password: '',
    requireApproval: false,
    maxMembers: 20,
    chatEnabled: true,
    waitForBuffering: true,
    autoPlay: { enabled: true, mode: 'sequential' },
    memberPermissions: ['playback', 'changeMedia', 'addMedia', 'chat'],
  };
}

export function valuesFromRoom(room: Room): RoomFormValues {
  const settings = room.settings;
  return {
    name: room.name,
    description: room.description || '',
    isPublic: room.isPublic,
    password: undefined,
    requireApproval: !!settings?.requireApproval,
    maxMembers: settings?.maxMembers || 20,
    chatEnabled: settings?.chatEnabled !== false,
    waitForBuffering: settings?.waitForBuffering !== false,
    autoPlay: settings?.autoPlay || { enabled: true, mode: 'sequential' },
    memberPermissions: settings?.memberPermissions || [
      'playback',
      'changeMedia',
      'addMedia',
      'chat',
    ],
  };
}
