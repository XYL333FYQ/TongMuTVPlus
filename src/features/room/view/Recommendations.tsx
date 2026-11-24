'use client';

/*
 * 房间舞台下方的“今晚看什么”：豆瓣热门（电影 / 剧集 / 综艺），一排海报，可以换一批。
 * 点一部 → 打开选片，自动用片名搜片源，再选择现在放或加入片单。
 */

import { RefreshCw, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import './Recommendations.css';

import { getDoubanCategories } from '@/lib/douban.client';
import type { DoubanItem } from '@/lib/types';
import { useLatest } from '@/hooks/useLatest';

import BusyDots from '@/components/feedback/BusyDots';
import RetryNotice from '@/components/feedback/RetryNotice';
import FilmPoster, { PosterSkeleton } from '@/components/poster/FilmPoster';

const KINDS = [
  {
    id: 'movie',
    label: '电影',
    params: { kind: 'movie', category: '热门', type: '全部' },
  },
  {
    id: 'tv',
    label: '剧集',
    params: { kind: 'tv', category: 'tv', type: 'tv' },
  },
  {
    id: 'show',
    label: '综艺',
    params: { kind: 'tv', category: 'show', type: 'show' },
  },
] as const;

type Kind = (typeof KINDS)[number]['id'];
const PAGE = 12;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export default function Recommendations(props: {
  onChoose(title: string): void;
  /** strip：手机房间页里聊天上方的一排片名；点“全部”看完整推荐 */
  variant?: 'strip';
  onMore?(): void;
}) {
  const [kind, setKind] = useState<Kind>('movie');
  const [pool, setPool] = useState<Partial<Record<Kind, DoubanItem[]>>>({});
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (target: Kind) => {
    setState('loading');
    try {
      const params = (KINDS.find((item) => item.id === target) ?? KINDS[0])
        .params;
      const data = await getDoubanCategories({
        ...params,
        pageStart: 0,
        pageLimit: 48,
      } as Parameters<typeof getDoubanCategories>[0]);
      if (data.code !== 200 || !data.list?.length) throw new Error('empty');
      const seen = new Set<string>();
      const list = shuffle(
        data.list.filter(
          (item) => item?.title && !seen.has(item.title) && seen.add(item.title)
        )
      );
      setPool((previous) => ({ ...previous, [target]: list }));
      setOffset(0);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  // 只在切换分类时决定要不要拉；已经拉过的分类直接用
  const poolLatest = useLatest(pool);
  useEffect(() => {
    if (poolLatest.current[kind]) {
      setState('ready');
      return;
    }
    void load(kind);
  }, [kind, load, poolLatest]);

  const list = useMemo(() => pool[kind] || [], [pool, kind]);
  const items = useMemo(() => {
    if (!list.length) return [];
    const start = offset % list.length;
    return [...list.slice(start), ...list.slice(0, start)].slice(0, PAGE);
  }, [list, offset]);

  if (props.variant === 'strip')
    return (
      <nav className='tm-room-recs-strip' aria-label='今晚看什么'>
        <span className='tm-room-recs-strip-label'>今晚看什么</span>
        {state === 'error' ? (
          <button
            type='button'
            className='tm-room-recs-chip'
            onClick={() => void load(kind)}
          >
            读不到，点这里重试
          </button>
        ) : (
          items.slice(0, 8).map((item) => (
            <button
              key={item.id || item.title}
              type='button'
              className='tm-room-recs-chip'
              onClick={() => props.onChoose(item.title)}
              title={`选这部：${item.title}`}
            >
              {item.title}
            </button>
          ))
        )}
        {props.onMore && (
          <button
            type='button'
            className='tm-room-recs-chip tm-room-recs-chip-more'
            onClick={props.onMore}
          >
            全部
          </button>
        )}
      </nav>
    );

  return (
    <section className='tm-room-recs' aria-labelledby='tm-room-recs-heading'>
      <header className='tm-room-recs-head'>
        <div>
          <h2 id='tm-room-recs-heading'>今晚看什么</h2>
        </div>
        <div className='tm-room-recs-tools'>
          <div className='tm-room-segment tm-room-segment-small' role='tablist'>
            {KINDS.map((item) => (
              <button
                key={item.id}
                type='button'
                role='tab'
                aria-selected={kind === item.id}
                onClick={() => setKind(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type='button'
            className='tm-room-icon'
            onClick={() =>
              state === 'error'
                ? void load(kind)
                : setOffset((value) => value + PAGE)
            }
            aria-label='换一批'
            title='换一批'
            aria-busy={state === 'loading' || undefined}
          >
            {state === 'loading' ? (
              <BusyDots size={18} />
            ) : (
              <RefreshCw size={18} />
            )}
          </button>
        </div>
      </header>
      {state === 'error' ? (
        <RetryNotice
          message='热门片单暂时读不到'
          onRetry={() => void load(kind)}
        />
      ) : (
        <ul className='tm-room-recs-row' aria-busy={state === 'loading'}>
          {(state === 'loading' && !items.length
            ? Array.from({ length: PAGE }, () => null)
            : items
          ).map((item, index) =>
            item ? (
              <li key={item.id || item.title}>
                <button
                  type='button'
                  className='tm-room-recs-item'
                  onClick={() => props.onChoose(item.title)}
                  title={`选这部：${item.title}`}
                >
                  <FilmPoster
                    src={item.poster}
                    title={item.title}
                    className='tm-room-recs-poster'
                  >
                    {item.rate && Number(item.rate) > 0 && (
                      <span className='tm-room-recs-rate'>
                        <Star size={11} aria-hidden='true' />
                        {item.rate}
                      </span>
                    )}
                  </FilmPoster>
                  <span className='tm-room-recs-name'>{item.title}</span>
                  {item.year && (
                    <span className='tm-room-recs-year'>{item.year}</span>
                  )}
                </button>
              </li>
            ) : (
              <li key={`skeleton-${index}`} aria-hidden='true'>
                <span className='tm-room-recs-item tm-room-recs-skeleton'>
                  <PosterSkeleton className='tm-room-recs-poster' />
                  <span className='tm-room-recs-name'>&nbsp;</span>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
