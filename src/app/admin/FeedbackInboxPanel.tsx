'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { FEATURE_PERMISSION_OPTIONS } from '@/lib/feature-permissions';
import {
  type FeedbackItem,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUS_LABEL,
} from '@/lib/feedback';
import { useNotificationTargetFocus } from '@/hooks/useNotificationTargetFocus';

import { notify, notifyError } from '@/components/feedback/AppDialogs';
import Select from '@/components/ui/Select';

// 管理面板「反馈收件箱」：用户提交的功能申请和反馈。
// 同意功能申请会直接给申请人单独授权，只有站长能做；管理员可以拒绝或标记已处理。

type Filter = 'pending' | 'done' | 'all';

const card =
  'rounded-lg border border-[var(--tm-line)] bg-[var(--tm-surface)] p-4';
const button =
  'inline-flex items-center justify-center px-3 py-1.5 min-h-[36px] text-[13px] font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] hover:bg-[var(--tm-line)] disabled:opacity-50';
const primary =
  'inline-flex items-center justify-center px-3 py-1.5 min-h-[36px] text-[13px] font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] hover:opacity-90 disabled:opacity-50';

const featureLabel = (key?: string) =>
  FEATURE_PERMISSION_OPTIONS.find((item) => item.key === key)?.label || '';

export default function FeedbackInboxPanel({
  isOwner,
  targetId,
  targetKey,
}: {
  isOwner: boolean;
  targetId?: string | null;
  targetKey?: string | null;
}) {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('pending');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (targetId) setFilter('all');
  }, [targetId, targetKey]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/feedback?all=1', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载失败');
      setItems(data.items || []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () =>
      (items || []).filter((item) =>
        filter === 'all'
          ? true
          : filter === 'pending'
          ? item.status === 'pending'
          : item.status !== 'pending'
      ),
    [items, filter]
  );
  const pendingCount = (items || []).filter(
    (item) => item.status === 'pending'
  ).length;
  const targetRef = useNotificationTargetFocus<HTMLElement>(
    targetId,
    shown.some((item) => item.id === targetId),
    targetKey
  );

  const act = async (item: FeedbackItem, action: string) => {
    setBusy(item.id);
    try {
      const response = await fetch(`/api/feedback/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reply: replies[item.id] || '' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '处理失败');
      notify(
        action === 'approve'
          ? `已授权给 ${item.username}`
          : '已处理，申请人会收到通知',
        'success'
      );
      await load();
    } catch (e) {
      notifyError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  if (error) {
    return (
      <div className={card}>
        <p className='text-[color:var(--tm-danger)]'>{error}</p>
        <button className={`${button} mt-3`} onClick={() => void load()}>
          重试
        </button>
      </div>
    );
  }
  if (!items) {
    return (
      <div className={`${card} text-sm text-[color:var(--tm-muted)]`}>
        加载中…
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-[color:var(--tm-muted)]'>
          待处理 {pendingCount} 条。同意功能申请会直接给申请人授权
          {!isOwner && '（只有站长可以同意）'}。
        </p>
        <Select
          aria-label='筛选'
          className='w-40'
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
        >
          <option value='pending'>待处理</option>
          <option value='done'>已处理</option>
          <option value='all'>全部</option>
        </Select>
      </div>

      {shown.length === 0 && (
        <div className={`${card} text-sm text-[color:var(--tm-muted)]`}>
          {filter === 'pending' ? '没有待处理的反馈。' : '没有记录。'}
        </div>
      )}

      {shown.map((item) => (
        <article
          key={item.id}
          ref={item.id === targetId ? targetRef : undefined}
          tabIndex={-1}
          className={`${card} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tm-text)]`}
        >
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='text-sm font-medium text-[color:var(--tm-text)]'>
              {item.username} ·{' '}
              {
                FEEDBACK_CATEGORIES.find((c) => c.value === item.category)
                  ?.label
              }
              {item.featureKey ? ` · ${featureLabel(item.featureKey)}` : ''}
            </div>
            <span className='rounded-full border border-[var(--tm-line)] px-2 py-0.5 text-[12px] text-[color:var(--tm-muted)]'>
              {FEEDBACK_STATUS_LABEL[item.status]}
            </span>
          </div>
          {item.message && (
            <p className='mt-2 whitespace-pre-wrap text-sm text-[color:var(--tm-text)]'>
              {item.message}
            </p>
          )}
          <div className='mt-1 text-[12px] text-[color:var(--tm-muted)]'>
            {new Date(item.createdAt).toLocaleString()}
          </div>

          {item.status === 'pending' ? (
            <div className='mt-3 space-y-3'>
              <input
                type='text'
                value={replies[item.id] || ''}
                maxLength={300}
                onChange={(event) =>
                  setReplies((prev) => ({
                    ...prev,
                    [item.id]: event.target.value,
                  }))
                }
                placeholder='回复（选填，会发给申请人）'
                aria-label='回复'
                className='w-full px-3 py-2 border border-[var(--tm-line)] rounded-lg bg-[var(--tm-surface)] text-[color:var(--tm-text)] min-h-[44px]'
              />
              <div className='flex flex-wrap gap-2'>
                {item.category === 'feature' && (
                  <button
                    className={primary}
                    disabled={!isOwner || busy === item.id}
                    title={isOwner ? undefined : '只有站长可以授权'}
                    onClick={() => void act(item, 'approve')}
                  >
                    同意并授权
                  </button>
                )}
                <button
                  className={button}
                  disabled={busy === item.id}
                  onClick={() => void act(item, 'reject')}
                >
                  拒绝
                </button>
                {item.category !== 'feature' && (
                  <button
                    className={button}
                    disabled={busy === item.id}
                    onClick={() => void act(item, 'resolve')}
                  >
                    标记已处理
                  </button>
                )}
              </div>
            </div>
          ) : (
            item.reply && (
              <p className='mt-2 rounded-md bg-[var(--tm-surface-raised)] px-3 py-2 text-[13px] text-[color:var(--tm-muted)]'>
                回复（{item.handledBy}）：{item.reply}
              </p>
            )
          )}
        </article>
      ))}
    </div>
  );
}
