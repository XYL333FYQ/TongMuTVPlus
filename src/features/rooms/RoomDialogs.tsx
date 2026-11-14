'use client';

import { ImagePlus, Trash2, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { roomCoverSource } from '@/features/together/lib/room-cover';
import { defaultRoomName } from '@/features/together/lib/room-presentation';

import { PERMISSION_LABELS, PERMISSION_ORDER } from './RoomMembers';

import type {
  Room,
  RoomAutoPlayMode,
  RoomPermission,
} from '@/types/watch-room';

/** 新房间的成员默认权限（与服务器默认一致） */
const MEMBER_DEFAULT: RoomPermission[] = [
  'playback',
  'changeMedia',
  'addMedia',
  'chat',
];
const AUTO_PLAY_LABEL: Record<RoomAutoPlayMode, string> = {
  sequential: '按片单顺序播放',
  loop: '片单循环',
  single: '单部循环',
};

/** 房间对话框外壳：原生模态、焦点约束、标题、关闭按钮、错误提示。 */
export function RoomDialogShell({
  title,
  busy,
  error,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = modal.current;
    if (!element) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // 沿用详情层的原生模态方案，由浏览器隔离背景并约束键盘焦点。
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={modal}
      className='tm-rooms tm-room-modal-root'
      aria-modal='true'
      aria-labelledby='tm-room-dialog-title'
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const targets = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]'
          )
        ).filter(
          (node) =>
            node.getClientRects().length || process.env.NODE_ENV === 'test'
        );
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div
        className='tm-room-dialog-backdrop'
        onClick={() => !busy && onClose()}
        role='presentation'
      >
        <section
          className='tm-room-dialog'
          onClick={(event) => event.stopPropagation()}
        >
          <header>
            <h2 id='tm-room-dialog-title'>{title}</h2>
            <button disabled={busy} onClick={onClose} aria-label='关闭'>
              <X size={20} />
            </button>
          </header>
          {children}
          {error && (
            <p className='tm-room-dialog-error' role='alert'>
              {error}
            </p>
          )}
        </section>
      </div>
    </dialog>,
    document.body
  );
}

/** 用房间号（和密码）加入朋友的房间。 */
export function JoinRoomForm({
  initialId,
  currentRoom,
  username,
  busy,
  onJoin,
}: {
  initialId: string;
  currentRoom: Room | null;
  username: string;
  busy: boolean;
  onJoin: (id: string, password: string) => void;
}) {
  const [roomId, setRoomId] = useState(initialId);
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onJoin(roomId, password);
      }}
    >
      <label>
        房间号
        <input
          required
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          maxLength={64}
        />
      </label>
      <label>
        房间密码（如果有）
        <input
          type='password'
          autoComplete='new-password'
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={128}
        />
      </label>
      {currentRoom && currentRoom.id !== roomId && (
        <p>加入时将退出「{currentRoom.name}」，其他成员继续观看。</p>
      )}
      <button className='tm-room-primary' disabled={busy || !roomId.trim()}>
        {busy ? '正在加入…' : username ? '进入房间' : '登录后加入'}
      </button>
    </form>
  );
}

export interface RoomFormValues {
  name: string;
  description: string;
  isPublic: boolean;
  memberPermissions: RoomPermission[];
  requireApproval: boolean;
  maxMembers: number;
  chatEnabled: boolean;
  autoPlay: { enabled: boolean; mode: RoomAutoPlayMode };
  waitForBuffering: boolean;
  /** 留空表示不设置 / 保留原密码 */
  password: string;
  autoArchive: boolean;
}

/** 创建房间与房间设置共用的表单；输入状态都在这里。 */
export function RoomForm({
  mode,
  room,
  username,
  isStationAdmin,
  busy,
  connected,
  onSubmit,
  onDelete,
  onUploadCover,
  onRemoveCover,
}: {
  mode: 'create' | 'settings';
  room: Room | null;
  username: string;
  isStationAdmin: boolean;
  busy: boolean;
  connected: boolean;
  onSubmit: (values: RoomFormValues) => void;
  onDelete: () => void;
  onUploadCover: (file?: File | null) => void;
  onRemoveCover: () => void;
}) {
  const editing = mode === 'settings' && room ? room : null;
  // 新建时名称留空，默认名只作为占位提示：直接输入不会和默认名拼在一起
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [isPublic, setIsPublic] = useState(Boolean(editing?.isPublic));
  const [memberPermissions, setMemberPermissions] = useState<RoomPermission[]>(
    editing?.settings?.memberPermissions || MEMBER_DEFAULT
  );
  const [requireApproval, setRequireApproval] = useState(
    Boolean(editing?.settings?.requireApproval)
  );
  const [maxMembers, setMaxMembers] = useState(
    editing?.settings?.maxMembers || 8
  );
  const [chatEnabled, setChatEnabled] = useState(
    editing?.settings?.chatEnabled !== false
  );
  const [waitForBuffering, setWaitForBuffering] = useState(
    editing?.settings?.waitForBuffering !== false
  );
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(
    editing?.settings?.autoPlay?.enabled !== false
  );
  const [autoPlayMode, setAutoPlayMode] = useState<RoomAutoPlayMode>(
    editing?.settings?.autoPlay?.mode || 'sequential'
  );
  // 权限类设置只有房主能改；管理员打开设置时只读显示
  const ownerControls = mode === 'create' || editing?.myRole === 'owner';
  const [password, setPassword] = useState('');
  const [autoArchive, setAutoArchive] = useState(
    editing?.settings?.autoArchive !== false
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          name,
          description,
          isPublic,
          memberPermissions,
          requireApproval,
          maxMembers,
          chatEnabled,
          autoPlay: { enabled: autoPlayEnabled, mode: autoPlayMode },
          waitForBuffering,
          password,
          autoArchive,
        });
      }}
    >
      <label>
        房间名称
        <input
          required={mode === 'settings'}
          maxLength={80}
          autoComplete='off'
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={
            mode === 'create' ? defaultRoomName(username) : '例如：周五夜场'
          }
        />
      </label>
      <label>
        一句介绍
        <textarea
          maxLength={500}
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder='介绍这个房间（可选）'
        />
      </label>
      {editing && (
        <div className='tm-room-cover-field'>
          <span>房间封面</span>
          <div className='tm-room-cover-preview'>
            {roomCoverSource(editing) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={roomCoverSource(editing) || ''}
                alt='房间封面预览'
                referrerPolicy='no-referrer'
              />
            ) : (
              '还没有封面'
            )}
          </div>
          <p>
            {editing.coverUrl
              ? '正在使用你上传的封面'
              : editing.nowPlaying?.poster
              ? '未上传封面时，显示正在放映影片的海报'
              : '未上传封面时，显示默认占位'}
          </p>
          <div className='tm-room-cover-actions'>
            <label>
              <ImagePlus size={16} aria-hidden />
              {editing.coverUrl ? '更换封面' : '上传封面'}
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                className='sr-only'
                disabled={busy}
                onChange={(event) => {
                  onUploadCover(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            {editing.coverUrl && (
              <button type='button' disabled={busy} onClick={onRemoveCover}>
                <Trash2 size={16} aria-hidden />
                移除封面
              </button>
            )}
          </div>
        </div>
      )}
      <label className='tm-room-checkbox'>
        <input
          type='checkbox'
          checked={isPublic}
          disabled={!ownerControls}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
        出现在公开房间列表
      </label>
      <label className='tm-room-checkbox'>
        <input
          type='checkbox'
          checked={requireApproval}
          disabled={!ownerControls}
          onChange={(event) => setRequireApproval(event.target.checked)}
        />
        加入需要房主或管理员同意
      </label>
      <fieldset className='tm-room-permission-grid' disabled={!ownerControls}>
        <legend>成员默认可以</legend>
        {PERMISSION_ORDER.map((permission) => (
          <label key={permission} className='tm-room-checkbox'>
            <input
              type='checkbox'
              checked={memberPermissions.includes(permission)}
              onChange={(event) =>
                setMemberPermissions((previous) =>
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
      </fieldset>
      <label className='tm-room-checkbox'>
        <input
          type='checkbox'
          checked={chatEnabled}
          onChange={(event) => setChatEnabled(event.target.checked)}
        />
        开启聊天（关闭后只有房主和管理员能发言）
      </label>
      <label className='tm-room-checkbox'>
        <input
          type='checkbox'
          checked={waitForBuffering}
          onChange={(event) => setWaitForBuffering(event.target.checked)}
        />
        有人卡住时全房间暂停等他（最多等 30 秒）
      </label>
      <label className='tm-room-checkbox'>
        <input
          type='checkbox'
          checked={autoPlayEnabled}
          onChange={(event) => setAutoPlayEnabled(event.target.checked)}
        />
        一部放完自动放下一部
      </label>
      {autoPlayEnabled && (
        <label>
          连播方式
          <select
            value={autoPlayMode}
            onChange={(event) =>
              setAutoPlayMode(event.target.value as RoomAutoPlayMode)
            }
          >
            {(Object.keys(AUTO_PLAY_LABEL) as RoomAutoPlayMode[]).map(
              (option) => (
                <option key={option} value={option}>
                  {AUTO_PLAY_LABEL[option]}
                </option>
              )
            )}
          </select>
        </label>
      )}
      <label>
        人数上限
        <input
          type='number'
          min={2}
          max={50}
          value={maxMembers}
          onChange={(event) =>
            setMaxMembers(Math.max(2, Number(event.target.value) || 2))
          }
        />
      </label>
      <label>
        {mode === 'create'
          ? '设置房间密码（可选）'
          : '更换密码（留空保留原密码）'}
        <input
          type='password'
          maxLength={128}
          autoComplete='new-password'
          disabled={!ownerControls}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <p>
        {isPublic
          ? '所有人可以看到房间介绍；登录后才能加入和播放。'
          : '默认私密，通过邀请地址或房间号加入。'}
      </p>
      <button
        className='tm-room-primary'
        disabled={busy || (mode === 'settings' && !name.trim()) || !connected}
      >
        {busy ? '正在保存…' : mode === 'create' ? '创建并进入' : '保存设置'}
      </button>
      {editing && isStationAdmin && (
        <label className='tm-room-checkbox'>
          <input
            type='checkbox'
            checked={autoArchive}
            onChange={(event) => setAutoArchive(event.target.checked)}
          />
          空闲30天后自动归档（关闭可长期保留）
        </label>
      )}
      {editing && editing.myRole === 'owner' && (
        <div className='tm-room-danger'>
          <label>
            删除房间请输入「{editing.name}」
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </label>
          <button
            type='button'
            disabled={busy || deleteConfirmation !== editing.name}
            onClick={onDelete}
          >
            <Trash2 size={14} />
            永久删除房间与聊天
          </button>
        </div>
      )}
    </form>
  );
}
