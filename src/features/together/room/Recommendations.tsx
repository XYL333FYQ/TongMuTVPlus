'use client';

/*
 * 房间舞台下方的“今晚看什么”：豆瓣热门（电影 / 剧集 / 综艺），一排海报，可以换一批。
 * 点一部 → 打开选片，自动用片名搜片源，再选择现在放或加入片单。
 */

import { RefreshCw, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDoubanCategories } from '@/lib/douban.client';
import type { DoubanItem } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

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
}) {
  const [kind, setKind] = useState<Kind>('movie');
  const [pool, setPool] = useState<Partial<Record<Kind, DoubanItem[]>>>({});
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async (target: Kind) => {
    setState('loading');
    try {
      const params = KINDS.find((item) => item.id === target)!.params;
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

  useEffect(() => {
    if (pool[kind]) {
      setState('ready');
      return;
    }
    void load(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const list = pool[kind] || [];
  const items = useMemo(() => {
    if (!list.length) return [];
    const start = offset % list.length;
    return [...list.slice(start), ...list.slice(0, start)].slice(0, PAGE);
  }, [list, offset]);

  return (
    <section className='tm-t-recs' aria-labelledby='tm-t-recs-title'>
      <header className='tm-t-section-head'>
        <div>
          <h2 id='tm-t-recs-title'>今晚看什么</h2>
        </div>
        <div className='tm-t-recs-tools'>
          <div className='tm-t-segment tm-t-segment-small' role='tablist'>
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
            className='tm-t-icon'
            onClick={() =>
              state === 'error'
                ? void load(kind)
                : setOffset((value) => value + PAGE)
            }
            aria-label='换一批'
            title='换一批'
          >
            <RefreshCw
              size={18}
              className={state === 'loading' ? 'tm-t-spin' : undefined}
            />
          </button>
        </div>
      </header>
      {state === 'error' ? (
        <p className='tm-t-empty'>热门片单暂时读不到，点右上角重试</p>
      ) : (
        <ul className='tm-t-recs-row' aria-busy={state === 'loading'}>
          {(state === 'loading' && !items.length
            ? Array.from({ length: PAGE }, () => null)
            : items
          ).map((item, index) =>
            item ? (
              <li key={item.id || item.title}>
                <button
                  type='button'
                  className='tm-t-rec'
                  onClick={() => props.onChoose(item.title)}
                  title={`选这部：${item.title}`}
                >
                  <span className='tm-t-rec-poster'>
                    {item.poster && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={processImageUrl(item.poster)}
                        alt=''
                        loading='lazy'
                        referrerPolicy='no-referrer'
                      />
                    )}
                    {item.rate && Number(item.rate) > 0 && (
                      <span className='tm-t-rec-rate'>
                        <Star size={11} aria-hidden='true' />
                        {item.rate}
                      </span>
                    )}
                  </span>
                  <span className='tm-t-rec-title'>{item.title}</span>
                  {item.year && (
                    <span className='tm-t-rec-year'>{item.year}</span>
                  )}
                </button>
              </li>
            ) : (
              <li key={`skeleton-${index}`} aria-hidden='true'>
                <span className='tm-t-rec tm-t-rec-skeleton'>
                  <span className='tm-t-rec-poster' />
                  <span className='tm-t-rec-title'>&nbsp;</span>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
