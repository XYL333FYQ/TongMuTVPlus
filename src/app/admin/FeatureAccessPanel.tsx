'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type FeaturePermissionKey,
  type FeaturePolicy,
  FEATURE_PERMISSION_OPTIONS,
  FEATURE_POLICY_OPTIONS,
} from '@/lib/feature-permissions';

import { notify, notifyError } from '@/components/feedback/AppDialogs';
import Select from '@/components/ui/Select';

// 管理面板「功能权限」：站长决定每个功能对谁开放，并可给某一个用户单独开口子。
// 管理员只能查看。数据通过 /api/admin/feature-access 读写。

interface AccessState {
  canEdit: boolean;
  policies: Record<string, FeaturePolicy>;
  grants: Record<string, FeaturePermissionKey[]>;
}

interface UserRow {
  username: string;
  role: string;
  banned?: boolean;
}

const card =
  'bg-[var(--tm-surface)] rounded-lg p-6 border border-[var(--tm-line)]';
const heading = 'text-lg font-medium text-[color:var(--tm-text)] mb-1';
const hint = 'text-sm text-[color:var(--tm-muted)]';
const button =
  'inline-flex items-center justify-center px-3 py-1.5 min-h-[36px] text-[13px] font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] hover:bg-[var(--tm-line)] disabled:opacity-50';
const primaryButton =
  'inline-flex items-center justify-center px-4 py-2 min-h-[40px] text-sm font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] hover:opacity-90 disabled:opacity-50';

const labelOf = (key: string) =>
  FEATURE_PERMISSION_OPTIONS.find((item) => item.key === key)?.label || key;

export default function FeatureAccessPanel() {
  const [state, setState] = useState<AccessState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<UserRow[]>([]);
  const [target, setTarget] = useState('');
  const [draft, setDraft] = useState<FeaturePermissionKey[]>([]);
  const [saving, setSaving] = useState(false);
  const searchSeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/feature-access', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载失败');
      setState(data);
      setLoadError('');
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 搜索用户（输入停顿后再查，旧请求的结果丢弃）
  useEffect(() => {
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/users?limit=8&search=${encodeURIComponent(search)}`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        if (seq !== searchSeq.current || !response.ok) return;
        setMatches(
          (data.users || []).filter(
            (user: UserRow) => user.role === 'user' && !user.banned
          )
        );
      } catch {
        // 查询失败时保留旧结果，不打断操作
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/admin/feature-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '保存失败');
  };

  const changePolicy = async (key: string, policy: FeaturePolicy) => {
    if (!state?.canEdit) return;
    const previous = state.policies[key];
    setState({ ...state, policies: { ...state.policies, [key]: policy } });
    try {
      await post({ action: 'setPolicy', key, policy });
      notify(`「${labelOf(key)}」的开放范围已更新`, 'success');
    } catch (error) {
      setState((now) =>
        now ? { ...now, policies: { ...now.policies, [key]: previous } } : now
      );
      notifyError((error as Error).message);
    }
  };

  const pickUser = (username: string) => {
    setTarget(username);
    setDraft(state?.grants[username] || []);
  };

  const toggle = (key: FeaturePermissionKey) =>
    setDraft((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );

  const saveGrants = async (username: string, keys: FeaturePermissionKey[]) => {
    setSaving(true);
    try {
      await post({ action: 'setGrants', username, keys });
      notify(
        keys.length
          ? `已更新 ${username} 的单独授权`
          : `已清除 ${username} 的单独授权`,
        'success'
      );
      await load();
      if (!keys.length && username === target) setDraft([]);
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={card}>
        <p className='text-[color:var(--tm-danger)]'>{loadError}</p>
        <button className={`${button} mt-3`} onClick={() => void load()}>
          重试
        </button>
      </div>
    );
  }
  if (!state) {
    return <div className={`${card} ${hint}`}>加载中…</div>;
  }

  const readOnly = !state.canEdit;
  const granted = Object.entries(state.grants);

  return (
    <div className='space-y-6'>
      <div className={card}>
        <h3 className={heading}>功能开放范围</h3>
        <p className={`${hint} mb-4`}>
          决定每个功能对谁可用。站长和管理员始终可以使用全部功能。
          {readOnly && '只有站长可以修改。'}
        </p>
        <div className='divide-y divide-[var(--tm-line)]'>
          {FEATURE_PERMISSION_OPTIONS.map((item) => (
            <div
              key={item.key}
              className='flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between'
            >
              <div className='min-w-0'>
                <div className='text-sm font-medium text-[color:var(--tm-text)]'>
                  {item.label}
                </div>
                <div className='text-[13px] text-[color:var(--tm-muted)]'>
                  {item.description}
                </div>
              </div>
              <Select
                aria-label={`${item.label}的开放范围`}
                className='w-full sm:w-48'
                value={state.policies[item.key]}
                disabled={readOnly}
                onChange={(event) =>
                  void changePolicy(
                    item.key,
                    event.target.value as FeaturePolicy
                  )
                }
              >
                {FEATURE_POLICY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
        <ul className='mt-4 space-y-1 text-[13px] text-[color:var(--tm-muted)]'>
          {FEATURE_POLICY_OPTIONS.map((option) => (
            <li key={option.value}>
              <strong className='text-[color:var(--tm-text)]'>
                {option.label}
              </strong>
              ：{option.description}
            </li>
          ))}
        </ul>
      </div>

      <div className={card}>
        <h3 className={heading}>单独授权</h3>
        <p className={`${hint} mb-4`}>
          给某一个用户单独开放功能，不受上面的范围和用户组限制。
        </p>

        {granted.length > 0 && (
          <div className='mb-5 space-y-2'>
            {granted.map(([username, keys]) => (
              <div
                key={username}
                className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--tm-line)] px-3 py-2'
              >
                <div className='min-w-0'>
                  <div className='text-sm font-medium text-[color:var(--tm-text)]'>
                    {username}
                  </div>
                  <div className='text-[13px] text-[color:var(--tm-muted)]'>
                    {keys.map(labelOf).join('、')}
                  </div>
                </div>
                <div className='flex gap-2'>
                  <button className={button} onClick={() => pickUser(username)}>
                    编辑
                  </button>
                  {!readOnly && (
                    <button
                      className={button}
                      disabled={saving}
                      onClick={() => void saveGrants(username, [])}
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
          <div className='space-y-4'>
            <div>
              <label
                htmlFor='feature-access-search'
                className='mb-2 block text-sm font-medium text-[color:var(--tm-muted)]'
              >
                选择用户
              </label>
              <input
                id='feature-access-search'
                type='text'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='输入用户名搜索'
                className='w-full px-3 py-2 border border-[var(--tm-line)] rounded-lg bg-[var(--tm-surface)] text-[color:var(--tm-text)] min-h-[44px]'
              />
              <div className='mt-2 flex flex-wrap gap-2'>
                {matches.length === 0 && (
                  <span className={hint}>没有可授权的普通用户</span>
                )}
                {matches.map((user) => (
                  <button
                    key={user.username}
                    type='button'
                    aria-pressed={target === user.username}
                    onClick={() => pickUser(user.username)}
                    className={`${button} ${
                      target === user.username
                        ? 'ring-2 ring-[var(--tm-text)]'
                        : ''
                    }`}
                  >
                    {user.username}
                  </button>
                ))}
              </div>
            </div>

            {target && (
              <div>
                <div className='mb-2 text-sm font-medium text-[color:var(--tm-text)]'>
                  授权给 {target}
                </div>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {FEATURE_PERMISSION_OPTIONS.map((item) => (
                    <label
                      key={item.key}
                      className='flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-[var(--tm-line)] px-3 py-2'
                    >
                      <input
                        type='checkbox'
                        checked={draft.includes(item.key)}
                        onChange={() => toggle(item.key)}
                      />
                      <span className='text-sm text-[color:var(--tm-text)]'>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
                <div className='mt-4 flex gap-2'>
                  <button
                    className={primaryButton}
                    disabled={saving}
                    onClick={() => void saveGrants(target, draft)}
                  >
                    {saving ? '保存中…' : '保存授权'}
                  </button>
                  <button
                    className={button}
                    onClick={() => {
                      setTarget('');
                      setDraft([]);
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
