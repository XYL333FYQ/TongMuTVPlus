'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import {
  type FeaturePermissionKey,
  FEATURE_PERMISSION_OPTIONS,
} from '@/lib/feature-permissions';
import {
  type FeedbackCategory,
  type FeedbackItem,
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_MESSAGE,
  FEEDBACK_STATUS_LABEL,
  isFeatureKey,
} from '@/lib/feedback';

import { notify, notifyError } from '@/components/feedback/AppDialogs';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import PageHeader from '@/components/shell/PageHeader';
import Select from '@/components/ui/Select';

const featureLabel = (key?: string) =>
  FEATURE_PERMISSION_OPTIONS.find((item) => item.key === key)?.label || '';

function FeedbackForm() {
  const params = useSearchParams();
  const presetFeature = params.get('feature');
  const [category, setCategory] = useState<FeedbackCategory>('feature');
  const [featureKey, setFeatureKey] = useState<FeaturePermissionKey>(
    isFeatureKey(presetFeature)
      ? presetFeature
      : FEATURE_PERMISSION_OPTIONS[0].key
  );
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/feedback', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载失败');
      setItems(data.items || []);
      setLoadError('');
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          featureKey: category === 'feature' ? featureKey : undefined,
          message,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '提交失败');
      setMessage('');
      notify('已提交，站长处理后会通知你', 'success');
      await load();
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg min-h-[44px]';

  return (
    <div className='grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]'>
      <section
        aria-labelledby='feedback-new'
        className='grid gap-4 content-start'
      >
        <h2 id='feedback-new' className='text-lg font-medium text-fg'>
          发给站长
        </h2>

        <div>
          <div className='mb-2 text-sm font-medium text-muted'>类型</div>
          <div className='grid gap-2 sm:grid-cols-2'>
            {FEEDBACK_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type='button'
                aria-pressed={category === item.value}
                onClick={() => setCategory(item.value)}
                className={`tm-press rounded-lg border px-4 py-3 text-left min-h-[44px] ${
                  category === item.value
                    ? 'border-fg bg-raised'
                    : 'border-line hover:border-fg'
                }`}
              >
                <span className='block text-sm font-medium text-fg'>
                  {item.label}
                </span>
                <span className='block text-[13px] text-muted'>
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {category === 'feature' && (
          <div>
            <label
              htmlFor='feedback-feature'
              className='mb-2 block text-sm font-medium text-muted'
            >
              想使用的功能
            </label>
            <Select
              id='feedback-feature'
              className={field}
              value={featureKey}
              onChange={(event) =>
                setFeatureKey(event.target.value as FeaturePermissionKey)
              }
            >
              {FEATURE_PERMISSION_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}：{item.description}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label
            htmlFor='feedback-message'
            className='mb-2 block text-sm font-medium text-muted'
          >
            {category === 'feature' ? '为什么需要（选填）' : '具体内容'}
          </label>
          <textarea
            id='feedback-message'
            value={message}
            maxLength={FEEDBACK_MAX_MESSAGE}
            rows={5}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              category === 'bug'
                ? '在哪个页面、做了什么、看到了什么'
                : '写给站长的话'
            }
            className={`${field} resize-y`}
          />
          <div className='mt-1 text-right text-[12px] text-muted'>
            {message.length} / {FEEDBACK_MAX_MESSAGE}
          </div>
        </div>

        <div>
          <button
            type='button'
            onClick={() => void submit()}
            disabled={submitting || (category !== 'feature' && !message.trim())}
            className='tm-btn tm-btn-primary tm-press'
          >
            {submitting ? '提交中…' : '提交'}
          </button>
        </div>
      </section>

      <section
        aria-labelledby='feedback-mine'
        className='grid gap-3 content-start'
      >
        <h2 id='feedback-mine' className='text-lg font-medium text-fg'>
          我的记录
        </h2>
        {loadError && (
          <p className='tm-inline-state'>
            {loadError}
            <button
              type='button'
              className='ml-3 underline'
              onClick={() => void load()}
            >
              重试
            </button>
          </p>
        )}
        {!loadError && items === null && (
          <p className='tm-inline-state'>加载中…</p>
        )}
        {items?.length === 0 && (
          <p className='tm-inline-state'>还没有提交过，写好后点「提交」。</p>
        )}
        {items?.map((item) => (
          <article
            key={item.id}
            className='rounded-lg border border-line bg-surface p-4'
          >
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='text-sm font-medium text-fg'>
                {
                  FEEDBACK_CATEGORIES.find((c) => c.value === item.category)
                    ?.label
                }
                {item.featureKey ? ` · ${featureLabel(item.featureKey)}` : ''}
              </div>
              <span className='rounded-full border border-line px-2 py-0.5 text-[12px] text-muted'>
                {FEEDBACK_STATUS_LABEL[item.status]}
              </span>
            </div>
            {item.message && (
              <p className='mt-2 whitespace-pre-wrap text-sm text-fg'>
                {item.message}
              </p>
            )}
            {item.reply && (
              <p className='mt-2 rounded-md bg-raised px-3 py-2 text-[13px] text-muted'>
                站长回复：{item.reply}
              </p>
            )}
            <div className='mt-2 text-[12px] text-muted'>
              {new Date(item.createdAt).toLocaleString()}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <PageLayout activePath='/feedback'>
      <PageContainer className='pb-12'>
        <PageHeader
          title='反馈与申请'
          description='申请还没开放给你的功能，或把问题和建议告诉站长'
        />
        <Suspense fallback={<p className='tm-inline-state'>加载中…</p>}>
          <FeedbackForm />
        </Suspense>
      </PageContainer>
    </PageLayout>
  );
}
