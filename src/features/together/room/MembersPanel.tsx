'use client';

/*
 * 成员：在线 / 离线、角色、单人权限调整、设为管理员、转让房主、移出（可拉黑）、加入审核。
 */

import { Check, Crown, ShieldCheck, UserMinus, X } from 'lucide-react';
import { useState } from 'react';

import { Dialog, MEMBER_PERMISSION_LABELS } from './RoomForm';

import type {
  Room,
  RoomPermission,
  RoomRosterMember,
} from '@/types/watch-room';

const ROLE: Record<string, string> = {
  owner: '房主',
  admin: '管理员',
  member: '成员',
  none: '',
};

export default function MembersPanel(props: {
  room: Room;
  self: string;
  canManage: boolean;
  isOwner: boolean;
  command(event: string, payload: Record<string, unknown>): Promise<unknown>;
}) {
  const roster = [...(props.room.roster || [])].sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      ['owner', 'admin', 'member', 'none'].indexOf(a.role) -
        ['owner', 'admin', 'member', 'none'].indexOf(b.role)
  );
  const [editing, setEditing] = useState<RoomRosterMember | null>(null);
  const [error, setError] = useState('');
  const run = async (event: string, payload: Record<string, unknown>) => {
    setError('');
    try {
      await props.command(event, payload);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作没有完成');
      return false;
    }
  };
  const requests = props.room.joinRequests || [];

  return (
    <div className='tm-t-members'>
      {error && (
        <p className='tm-t-error' role='alert'>
          {error}
        </p>
      )}
      {requests.length > 0 && (
        <section className='tm-t-block'>
          <div className='tm-t-block-head'>
            <h3>申请加入 · {requests.length}</h3>
          </div>
          <ul className='tm-t-roster'>
            {requests.map((request) => (
              <li key={request.accountId} className='tm-t-member'>
                <span className='tm-t-avatar'>
                  {request.accountId.slice(0, 1).toUpperCase()}
                </span>
                <span className='tm-t-member-text'>
                  <strong>{request.accountId}</strong>
                </span>
                <button
                  type='button'
                  className='tm-t-icon'
                  aria-label='同意'
                  onClick={() =>
                    void run('room:join-review', {
                      accountId: request.accountId,
                      approve: true,
                    })
                  }
                >
                  <Check size={16} />
                </button>
                <button
                  type='button'
                  className='tm-t-icon'
                  aria-label='拒绝'
                  onClick={() =>
                    void run('room:join-review', {
                      accountId: request.accountId,
                      approve: false,
                    })
                  }
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className='tm-t-block'>
        <div className='tm-t-block-head'>
          <h3>
            成员 · {roster.filter((member) => member.online).length} 在线 /{' '}
            {roster.length}
          </h3>
        </div>
        <ul className='tm-t-roster'>
          {roster.map((member) => {
            const me = member.accountId === props.self;
            const manageable =
              props.canManage &&
              !me &&
              member.role !== 'owner' &&
              (props.isOwner || member.role !== 'admin');
            return (
              <li
                key={member.accountId}
                className='tm-t-member'
                data-offline={member.online ? undefined : 'true'}
              >
                <span className='tm-t-avatar'>
                  {member.accountId.slice(0, 1).toUpperCase()}
                  <span
                    className='tm-t-presence'
                    data-on={member.online ? 'true' : undefined}
                  />
                </span>
                <span className='tm-t-member-text'>
                  <strong>
                    {member.accountId}
                    {me && <span className='tm-t-me'>我</span>}
                  </strong>
                  <small>
                    {member.role === 'owner' && <Crown size={12} />}
                    {member.role === 'admin' && <ShieldCheck size={12} />}
                    {ROLE[member.role]}
                    {member.customPermissions && member.role === 'member'
                      ? ' · 单独设置了权限'
                      : ''}
                    {member.connections > 1
                      ? ` · ${member.connections} 台设备`
                      : ''}
                  </small>
                </span>
                {manageable && (
                  <button
                    type='button'
                    className='tm-t-link'
                    onClick={() => setEditing(member)}
                  >
                    管理
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {editing && (
        <MemberDialog
          member={editing}
          isOwner={props.isOwner}
          defaults={props.room.settings?.memberPermissions || []}
          onClose={() => setEditing(null)}
          run={async (event, payload) => {
            const ok = await run(event, {
              accountId: editing.accountId,
              ...payload,
            });
            if (ok) setEditing(null);
          }}
          error={error}
        />
      )}
    </div>
  );
}

function MemberDialog(props: {
  member: RoomRosterMember;
  isOwner: boolean;
  defaults: RoomPermission[];
  error: string;
  onClose(): void;
  run(event: string, payload: Record<string, unknown>): Promise<void>;
}) {
  const { member } = props;
  const [permissions, setPermissions] = useState<RoomPermission[]>(
    member.permissions
  );
  const [confirmKick, setConfirmKick] = useState(false);
  return (
    <Dialog title={`管理 ${member.accountId}`} onClose={props.onClose}>
      <div className='tm-t-form'>
        {member.role === 'member' && (
          <section className='tm-t-form-section'>
            <h3>这个人可以</h3>
            <div className='tm-t-perms'>
              {MEMBER_PERMISSION_LABELS.map((item) => (
                <label key={item.id} className='tm-t-perm'>
                  <input
                    type='checkbox'
                    checked={permissions.includes(item.id)}
                    onChange={(event) =>
                      setPermissions(
                        event.target.checked
                          ? [...permissions, item.id]
                          : permissions.filter((p) => p !== item.id)
                      )
                    }
                  />
                  <span>
                    <span>{item.label}</span>
                    <small>{item.hint}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className='tm-t-form-actions'>
              {member.customPermissions && (
                <button
                  type='button'
                  className='tm-t-btn'
                  onClick={() =>
                    void props.run('room:member-permissions', {
                      permissions: null,
                    })
                  }
                >
                  恢复默认
                </button>
              )}
              <span className='tm-t-spacer' />
              <button
                type='button'
                className='tm-t-btn tm-t-btn-primary'
                onClick={() =>
                  void props.run('room:member-permissions', { permissions })
                }
              >
                保存权限
              </button>
            </div>
          </section>
        )}
        {props.isOwner && (
          <section className='tm-t-form-section'>
            <h3>角色</h3>
            <div className='tm-t-form-actions'>
              <button
                type='button'
                className='tm-t-btn'
                onClick={() =>
                  void props.run('room:authorize-host', {
                    canHost: member.role !== 'admin',
                  })
                }
              >
                <ShieldCheck size={16} />
                {member.role === 'admin' ? '取消管理员' : '设为管理员'}
              </button>
              <button
                type='button'
                className='tm-t-btn'
                onClick={() => void props.run('room:transfer', {})}
              >
                <Crown size={16} />
                转让房主
              </button>
            </div>
          </section>
        )}
        <section className='tm-t-form-section'>
          <h3>移出房间</h3>
          {confirmKick ? (
            <div className='tm-t-form-actions'>
              <button
                type='button'
                className='tm-t-btn'
                onClick={() => void props.run('room:kick', { ban: false })}
              >
                只移出
              </button>
              <button
                type='button'
                className='tm-t-btn tm-t-btn-danger'
                onClick={() => void props.run('room:kick', { ban: true })}
              >
                移出并不让再进
              </button>
            </div>
          ) : (
            <button
              type='button'
              className='tm-t-btn tm-t-btn-danger'
              onClick={() => setConfirmKick(true)}
            >
              <UserMinus size={16} />
              移出 {member.accountId}
            </button>
          )}
        </section>
        {props.error && (
          <p className='tm-t-error' role='alert'>
            {props.error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
