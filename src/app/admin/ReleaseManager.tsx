'use client';

import { Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useId, useRef, useState } from 'react';

import { type ReleaseInfo, parseReleaseInfo } from '@/lib/release-info';

const inputClass =
  'mt-2 w-full min-h-[44px] rounded-lg border border-line bg-surface px-3 py-2 text-base text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg';
const buttonClass =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-line bg-raised px-4 py-2 text-sm text-fg hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50 tm-press';
const categories = [
  { key: 'added', label: '新增功能' },
  { key: 'changed', label: '功能改进' },
  { key: 'fixed', label: '问题修复' },
] as const;
type DraftEntry = {
  version: string;
  date: string;
  added: string;
  changed: string;
  fixed: string;
};
const toDraft = (info: ReleaseInfo): DraftEntry[] =>
  info.entries.map((entry) => ({
    ...entry,
    added: entry.added.join('\n'),
    changed: entry.changed.join('\n'),
    fixed: entry.fixed.join('\n'),
  }));

export default function ReleaseManager() {
  const id = useId();
  const [entries, setEntries] = useState<DraftEntry[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const revision = useRef('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const saveController = useRef<AbortController>();
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setConflict(false);
    const load = async () => {
      try {
        const response = await fetch('/api/admin/releases', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '读取发布记录失败');
        if (!controller.signal.aborted) {
          revision.current = response.headers.get('ETag') || '';
          setEntries(toDraft(parseReleaseInfo(data)));
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError((cause as Error).message);
      }
    };
    void load();
    return () => {
      controller.abort();
      saveController.current?.abort();
    };
  }, [attempt]);

  const update = (index: number, key: keyof DraftEntry, value: string) => {
    setEntries(
      (current) =>
        current?.map((entry, n) =>
          n === index ? { ...entry, [key]: value } : entry
        ) || null
    );
    setError('');
    setSuccess('');
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!entries || savingRef.current) return;
    setError('');
    setSuccess('');
    const split = (value: string) =>
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    let payload: ReleaseInfo;
    try {
      payload = parseReleaseInfo({
        version: entries[0]?.version,
        entries: entries.map((entry) => ({
          ...entry,
          added: split(entry.added),
          changed: split(entry.changed),
          fixed: split(entry.fixed),
        })),
      });
    } catch (cause) {
      setError((cause as Error).message);
      window.requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const controller = new AbortController();
    saveController.current = controller;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/releases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': revision.current,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 409) setConflict(true);
      if (!response.ok) throw new Error(data.error || '保存失败，请重试');
      if (controller.signal.aborted) return;
      revision.current = response.headers.get('ETag') || '';
      setEntries(toDraft(parseReleaseInfo(data)));
      setSuccess('已发布，版本信息已更新');
      window.dispatchEvent(new Event('tongmu:release-updated'));
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      savingRef.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  };

  return (
    <section className='rounded-lg border border-line bg-surface p-4 sm:p-6 space-y-6'>
      <header className='space-y-2'>
        <h2 className='text-lg font-medium text-fg'>版本与发布记录</h2>
        <p id={`${id}-help`} className='text-sm leading-6 text-muted'>
          第一条记录的版本号作为当前对外版本。每行填写一条，仅发布普通用户可见的变化；保存后立即显示在版本信息中。
        </p>
        <p className='text-sm leading-6 text-muted'>
          这里维护展示版本与记录，不会更新程序或触发部署。历史记录会保留，删除记录需保存后才生效。
        </p>
      </header>
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role='alert'
          className='text-sm text-[var(--tm-danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg'
        >
          {error}
        </p>
      )}
      {conflict && (
        <button
          type='button'
          className={buttonClass}
          onClick={() => {
            setEntries(null);
            setSuccess('');
            setAttempt((value) => value + 1);
          }}
        >
          重新加载（放弃当前草稿）
        </button>
      )}
      {!entries ? (
        error ? (
          <button
            type='button'
            className={buttonClass}
            onClick={() => setAttempt((value) => value + 1)}
          >
            重试
          </button>
        ) : (
          <p className='text-sm text-muted' role='status'>
            正在读取发布记录…
          </p>
        )
      ) : (
        <form
          action='/api/admin/releases'
          method='post'
          noValidate
          onSubmit={save}
          aria-describedby={`${id}-help`}
          className='space-y-6'
        >
          <fieldset disabled={saving} className='min-w-0 space-y-6'>
            <legend className='sr-only'>编辑发布记录</legend>
            <button
              type='button'
              className={buttonClass}
              disabled={entries.length >= 50}
              onClick={() => {
                const now = new Date();
                const date = `${now.getFullYear()}-${String(
                  now.getMonth() + 1
                ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                setEntries([
                  { version: '', date, added: '', changed: '', fixed: '' },
                  ...entries,
                ]);
                setError('');
                setSuccess('');
              }}
            >
              <Plus size={16} aria-hidden='true' />
              新增版本
            </button>
            {entries.map((entry, index) => (
              <fieldset
                key={index}
                className='min-w-0 rounded-lg border border-line p-4 space-y-4'
              >
                <legend className='px-2 text-sm font-medium text-fg'>
                  {index === 0
                    ? '当前版本'
                    : `历史版本 ${entry.version || index}`}
                </legend>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <label
                    className='min-w-0 text-sm text-fg'
                    htmlFor={`${id}-${index}-version`}
                  >
                    版本号
                    <input
                      id={`${id}-${index}-version`}
                      name={`version-${index}`}
                      value={entry.version}
                      onChange={(event) =>
                        update(index, 'version', event.target.value)
                      }
                      required
                      maxLength={24}
                      autoComplete='off'
                      autoCapitalize='none'
                      spellCheck={false}
                      placeholder='0.1.1'
                      className={inputClass}
                    />
                  </label>
                  <label
                    className='min-w-0 text-sm text-fg'
                    htmlFor={`${id}-${index}-date`}
                  >
                    发布日期
                    <input
                      id={`${id}-${index}-date`}
                      name={`date-${index}`}
                      value={entry.date}
                      onChange={(event) =>
                        update(index, 'date', event.target.value)
                      }
                      required
                      maxLength={10}
                      autoComplete='off'
                      placeholder='YYYY-MM-DD'
                      className={inputClass}
                    />
                  </label>
                </div>
                {categories.map(({ key, label }) => (
                  <label
                    key={key}
                    htmlFor={`${id}-${index}-${key}`}
                    className='block text-sm text-fg'
                  >
                    {label}
                    <textarea
                      id={`${id}-${index}-${key}`}
                      name={`${key}-${index}`}
                      value={entry[key]}
                      onChange={(event) =>
                        update(index, key, event.target.value)
                      }
                      rows={3}
                      maxLength={15030}
                      placeholder='每行一条，可留空'
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                ))}
                <button
                  type='button'
                  className={buttonClass}
                  disabled={entries.length === 1}
                  aria-label={`移除版本 ${entry.version || '未填写'}`}
                  onClick={() => {
                    setEntries(entries.filter((_, n) => n !== index));
                    setSuccess('');
                    setError('');
                  }}
                >
                  <Trash2 size={16} aria-hidden='true' />
                  移除记录
                </button>
              </fieldset>
            ))}
          </fieldset>
          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='submit'
              disabled={saving}
              className='inline-flex min-h-[44px] items-center justify-center rounded-lg bg-fg px-5 py-2 text-sm font-medium text-inverse hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50 tm-press'
            >
              {saving ? '正在保存…' : '保存并发布'}
            </button>
            <p role='status' className='text-sm text-muted'>
              {success}
            </p>
          </div>
        </form>
      )}
    </section>
  );
}
