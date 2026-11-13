'use client';

import { Shield } from 'lucide-react';
import { useState } from 'react';

import RoomActionMenu, { type RoomMenuItem } from './RoomActionMenu';

import type {
  Room,
  RoomPermission,
  RoomRosterMember,
} from '@/types/watch-room';

/** 权限的中文名称与说明，房间设置和成员权限共用 */
export const PERMISSION_LABELS: Record<
  RoomPermission,
  { label: string; hint: string }
> = {
  playback: { label: '控制播放', hint: '播放、暂停、拖动和倍速' },
  changeMedia: { label: '换片换集', hint: '切换影片和集数、停止放映' },
  addMedia: { label: '添加影片', hint: '往片单里添加影片' },
  managePlaylist: { label: '管理片单', hint: '排序、移除别人添加的、清空片单' },
  chat: { label: '发言', hint: '在房间聊天' },
  manageMembers: {
    label: '管理成员',
    hint: '审核加入、踢出成员、调整成员权限',
  },
  editRoom: { label: '修改房间', hint: '名称、简介、封面和聊天、连播设置' },
};
export const PERMISSION_ORDER = Object.keys(
  PERMISSION_LABELS
) as RoomPermission[];

const ROLE_LABEL = { owner: '房主', admin: '管理员', member: '成员', none: '' };

/**
 * 成员面板（参照 SyncTV）：全部成员与在线状态、角色、加入申请；
 * 有“管理成员”权限的人可以审核、踢出、调整权限；房主还能设管理员、转让房主。
 */
export default function RoomMembers({
  room,
  selfAccountId,
  busy,
  active,
  mutate,
}: {
  room: Room;
  selfAccountId: string;
  busy: boolean;
  active: boolean;
  mutate: (event: string, payload: Record<string, unknown>) => unknown;
}) {
  const [editing, setEditing] = useState<RoomRosterMember | null>(null);
  const roster = room.roster || [];
  const myRole = room.myRole || 'none';
  const canManage = Boolean(room.myPermissions?.includes('manageMembers'));
  const isOwner = myRole === 'owner';
  const online = roster.filter((member) => member.online).length;
  const requests = room.joinRequests || [];

  const actions = (member: RoomRosterMember): RoomMenuItem[] => {
    if (member.accountId === selfAccountId || member.role === 'owner')
      return [];
    if (member.role === 'admin' && !isOwner) return [];
    const items: RoomMenuItem[] = [];
    if (isOwner)
      items.push({
        label: member.role === 'admin' ? '取消管理员' : '设为管理员',
        disabled: busy,
        onSelect: () =>
          void mutate('room:authorize-host', {
            accountId: member.accountId,
            canHost: member.role !== 'admin',
          }),
      });
    if (canManage) {
      items.push({
        label: '调整权限',
        disabled: busy,
        onSelect: () => setEditing(member),
      });
      items.push({
        label: '移出房间',
        danger: true,
        disabled: busy,
        onSelect: () =>
          void mutate('room:kick', { accountId: member.accountId }),
      });
      items.push({
        label: '移出并禁止再加入',
        danger: true,
        disabled: busy,
        onSelect: () =>
          void mutate('room:kick', {
            accountId: member.accountId,
            ban: true,
          }),
      });
    }
    if (isOwner)
      items.push({
        label: '转让房主',
        danger: true,
        disabled: busy,
        onSelect: () => {
          if (
            window.confirm(
              `把房主转让给 ${member.accountId}？你会变成管理员，之后不能再收回。`
            )
          )
            void mutate('room:transfer', { accountId: member.accountId });
        },
      });
    return items;
  };

  return (
    <section
      className='tm-room-members'
      id='tm-room-panel-members'
      role='tabpanel'
      aria-labelledby='tm-room-tab-members'
      tabIndex={0}
      data-active={active}
      data-expanded={active}
      aria-label='成员'
    >
      <header>
        <h2>成员</h2>
        <span>
          {online} 人在线 · 共 {roster.length} 人
        </span>
      </header>
      {canManage && requests.length > 0 && (
        <div className='tm-room-join-requests' aria-label='加入申请'>
          <h3>加入申请 {requests.length}</h3>
          {requests.map((request) => (
            <div key={request.accountId} className='tm-room-member'>
              <span className='tm-room-avatar'>
                {request.accountId.charAt(0).toUpperCase()}
              </span>
              <div>
                <h3>{request.accountId}</h3>
                <p>申请加入</p>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate('room:join-review', {
                    accountId: request.accountId,
                    approve: true,
                  })
                }
              >
                同意
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate('room:join-review', {
                    accountId: request.accountId,
                    approve: false,
                  })
                }
              >
                拒绝
              </button>
            </div>
          ))}
        </div>
      )}
      {roster.map((member) => {
        const items = actions(member);
        return (
          <div
            key={member.accountId}
            className='tm-room-member'
            data-online={member.online}
          >
            <span className='tm-room-avatar'>
              {member.accountId.charAt(0).toUpperCase()}
              <i
                className='tm-dot tm-room-member-presence'
                data-live={member.online}
                aria-hidden
              />
            </span>
            <div>
              <h3>
                {member.accountId}
                {member.accountId === selfAccountId && '（你）'}
              </h3>
              <p>
                {[
                  ROLE_LABEL[member.role],
                  member.online
                    ? member.connections > 1
                      ? `在线 · ${member.connections} 个设备`
                      : '在线'
                    : '不在线',
                  member.customPermissions ? '单独设置了权限' : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {(member.role === 'owner' || member.role === 'admin') && (
              <Shield size={15} aria-label={ROLE_LABEL[member.role]} />
            )}
            {items.length > 0 && (
              <RoomActionMenu
                label={`${member.accountId}的成员操作`}
                items={items}
              />
            )}
          </div>
        );
      })}
      {editing && (
        <MemberPermissionEditor
          member={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(permissions) => {
            void mutate('room:member-permissions', {
              accountId: editing.accountId,
              permissions,
            });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function MemberPermissionEditor({
  member,
  busy,
  onCancel,
  onSave,
}: {
  member: RoomRosterMember;
  busy: boolean;
  onCancel: () => void;
  onSave: (permissions: RoomPermission[] | null) => void;
}) {
  const [selected, setSelected] = useState<RoomPermission[]>(
    member.permissions
  );
  return (
    <form
      className='tm-room-permission-editor'
      aria-label={`${member.accountId}的权限`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(selected);
      }}
    >
      <h3>{member.accountId} 的权限</h3>
      {PERMISSION_ORDER.map((permission) => (
        <label key={permission} className='tm-room-checkbox'>
          <input
            type='checkbox'
            checked={selected.includes(permission)}
            onChange={(event) =>
              setSelected((previous) =>
                event.target.checked
                  ? [...previous, permission]
                  : previous.filter((item) => item !== permission)
              )
            }
          />
          <span>
            {PERMISSION_LABELS[permission].label}
            <small>{PERMISSION_LABELS[permission].hint}</small>
          </span>
        </label>
      ))}
      <div className='tm-room-permission-actions'>
        <button type='submit' className='tm-room-primary' disabled={busy}>
          保存
        </button>
        <button type='button' disabled={busy} onClick={() => onSave(null)}>
          恢复角色默认
        </button>
        <button type='button' onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
