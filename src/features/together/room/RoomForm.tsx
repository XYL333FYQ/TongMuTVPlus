'use client';

/*
 * 创建房间 / 房间设置。
 */

import { ImagePlus, Trash2, X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';

import { compressRoomCover } from '../lib/room-cover';

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

export function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div
      className='tm-t-dialog-backdrop'
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className='tm-t-dialog'
        data-wide={wide ? 'true' : undefined}
        role='dialog'
        aria-modal='true'
        aria-label={title}
      >
        <div className='tm-t-dialog-head'>
          <h2>{title}</h2>
          <button
            type='button'
            className='tm-t-icon'
            onClick={onClose}
            aria-label='关闭'
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className='tm-t-switch-row'>
      <span>
        <span className='tm-t-switch-label'>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type='checkbox'
        role='switch'
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function RoomForm(props: {
  mode: 'create' | 'edit';
  initial: RoomFormValues;
  busy: boolean;
  error: string;
  room?: Room;
  onSubmit(values: RoomFormValues): void;
  onCover?(image: string | null): Promise<void>;
  onDelete?(): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState(props.initial);
  const [changePassword, setChangePassword] = useState(props.mode === 'create');
  const [coverError, setCoverError] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const set = <K extends keyof RoomFormValues>(
    key: K,
    value: RoomFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit({
      ...values,
      password: changePassword ? values.password || '' : undefined,
    });
  };

  return (
    <form className='tm-t-form' onSubmit={submit}>
      <section className='tm-t-form-section'>
        <label className='tm-t-field'>
          <span>房间名称</span>
          <input
            value={values.name}
            maxLength={80}
            onChange={(event) => set('name', event.target.value)}
            required
          />
        </label>
        <label className='tm-t-field'>
          <span>简介（可不填）</span>
          <textarea
            rows={2}
            maxLength={500}
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>
        {props.mode === 'edit' && props.onCover && (
          <div className='tm-t-field'>
            <span>封面</span>
            <div className='tm-t-cover-row'>
              <button
                type='button'
                className='tm-t-btn'
                onClick={() => fileInput.current?.click()}
                disabled={props.busy}
              >
                <ImagePlus size={16} />
                上传封面
              </button>
              {props.room?.coverUrl && (
                <button
                  type='button'
                  className='tm-t-btn'
                  onClick={() => void props.onCover?.(null)}
                  disabled={props.busy}
                >
                  移除封面
                </button>
              )}
              <input
                ref={fileInput}
                type='file'
                accept='image/*'
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  try {
                    setCoverError('');
                    await props.onCover?.(await compressRoomCover(file));
                  } catch (reason) {
                    setCoverError(
                      reason instanceof Error ? reason.message : '封面上传失败'
                    );
                  }
                }}
              />
            </div>
            {coverError && <small className='tm-t-error'>{coverError}</small>}
          </div>
        )}
      </section>

      <section className='tm-t-form-section'>
        <h3>谁能进来</h3>
        <Switch
          label='公开房间'
          hint='出现在公开房间列表里'
          checked={values.isPublic}
          onChange={(v) => set('isPublic', v)}
        />
        <Switch
          label='加入需要同意'
          hint='新成员要等房主或管理员通过'
          checked={values.requireApproval}
          onChange={(v) => set('requireApproval', v)}
        />
        {props.mode === 'edit' && !changePassword ? (
          <button
            type='button'
            className='tm-t-link'
            onClick={() => setChangePassword(true)}
          >
            {props.room?.hasPassword ? '修改或取消密码' : '设置密码'}
          </button>
        ) : (
          <label className='tm-t-field'>
            <span>密码（留空表示不需要）</span>
            <input
              type='text'
              autoComplete='off'
              maxLength={128}
              value={values.password || ''}
              onChange={(event) => set('password', event.target.value)}
            />
          </label>
        )}
        <label className='tm-t-field tm-t-field-inline'>
          <span>人数上限</span>
          <input
            type='number'
            min={2}
            max={100}
            value={values.maxMembers}
            onChange={(event) =>
              set('maxMembers', Math.max(2, Number(event.target.value) || 2))
            }
          />
        </label>
      </section>

      <section className='tm-t-form-section'>
        <h3>成员默认可以</h3>
        <div className='tm-t-perms'>
          {MEMBER_PERMISSION_LABELS.map((item) => (
            <label key={item.id} className='tm-t-perm'>
              <input
                type='checkbox'
                checked={values.memberPermissions.includes(item.id)}
                onChange={(event) =>
                  set(
                    'memberPermissions',
                    event.target.checked
                      ? [...values.memberPermissions, item.id]
                      : values.memberPermissions.filter(
                          (permission) => permission !== item.id
                        )
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
      </section>

      <section className='tm-t-form-section'>
        <h3>放映</h3>
        <Switch
          label='等人缓冲'
          hint='有人卡住时全房间暂停等他，最多等 30 秒'
          checked={values.waitForBuffering}
          onChange={(v) => set('waitForBuffering', v)}
        />
        <Switch
          label='自动连播'
          hint='播完自动放下一集或片单里的下一部'
          checked={values.autoPlay.enabled}
          onChange={(v) => set('autoPlay', { ...values.autoPlay, enabled: v })}
        />
        {values.autoPlay.enabled && (
          <div
            className='tm-t-segment tm-t-segment-small'
            role='radiogroup'
            aria-label='连播方式'
          >
            {(
              [
                ['sequential', '顺序播放'],
                ['loop', '片单循环'],
                ['single', '单集循环'],
              ] as Array<[RoomAutoPlayMode, string]>
            ).map(([mode, label]) => (
              <button
                key={mode}
                type='button'
                role='radio'
                aria-checked={values.autoPlay.mode === mode}
                aria-selected={values.autoPlay.mode === mode}
                onClick={() => set('autoPlay', { ...values.autoPlay, mode })}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <Switch
          label='聊天'
          hint='关闭后只有房主和管理员能发言'
          checked={values.chatEnabled}
          onChange={(v) => set('chatEnabled', v)}
        />
      </section>

      {props.error && (
        <p className='tm-t-error' role='alert'>
          {props.error}
        </p>
      )}
      <div className='tm-t-form-actions'>
        {props.onDelete && (
          <button
            type='button'
            className='tm-t-btn tm-t-btn-danger'
            onClick={props.onDelete}
            disabled={props.busy}
          >
            <Trash2 size={16} />
            删除房间
          </button>
        )}
        <span className='tm-t-spacer' />
        <button type='button' className='tm-t-btn' onClick={props.onCancel}>
          取消
        </button>
        <button
          type='submit'
          className='tm-t-btn tm-t-btn-primary'
          disabled={props.busy}
        >
          {props.mode === 'create' ? '创建并进入' : '保存'}
        </button>
      </div>
    </form>
  );
}
