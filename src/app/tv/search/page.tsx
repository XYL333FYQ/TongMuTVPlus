'use client';

import { Film, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { addSearchHistory, getSearchHistory } from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import TVLayout from '@/components/tv/TVLayout';

const hot = [
  '庆余年',
  '流浪地球',
  '繁花',
  '甄嬛传',
  '鬼灭之刃',
  '歌手',
  '三体',
  '权力的游戏',
];

function getSearchCacheKey(query: string) {
  return `search_cache_${query.trim()}`;
}

function setCachedSearchResults(query: string, nextResults: SearchResult[]) {
  try {
    sessionStorage.setItem(
      getSearchCacheKey(query),
      JSON.stringify({
        status: 'complete',
        results: nextResults,
        query: query.trim(),
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage failures
  }
}

type TVSearchDisplayItem = {
  key: string;
  title: string;
  poster?: string;
  year?: string;
  vodRemarks?: string;
  sourceName?: string;
  sourceNames: string[];
  source?: string;
  id?: string;
  isAggregate: boolean;
};

function normalizeTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[第\s._\-:：]+/g, '')
    .replace(/[（(].*?[）)]/g, '');
}

function getResultType(item: SearchResult) {
  const text = `${item.type_name || ''} ${item.class || ''}`.toLowerCase();
  if (text.includes('电影') || text.includes('movie')) return 'movie';
  return 'tv';
}

function getValidYear(item: SearchResult) {
  return item.year && /^\d{4}$/.test(item.year) ? item.year : 'unknown';
}

function getTVDetailUrl(item: TVSearchDisplayItem) {
  const params = new URLSearchParams({
    title: item.title,
  });
  if (!item.isAggregate && item.source) params.set('source', item.source);
  if (!item.isAggregate && item.id) params.set('id', item.id);
  return `/tv/detail?${params.toString()}`;
}

export default function TVSearchPage() {
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState('');
  const [error, setError] = useState('');
  const firstResultRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    getSearchHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  const runSearch = (value: string) => {
    const q = value.trim();
    if (!q) return;
    setKeyword(q);
    setSearched(q);
    setLoading(true);
    setError('');
    setResults([]);
    addSearchHistory(q).catch(() => undefined);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((response) => {
        if (!response.ok) throw new Error('搜索失败');
        return response.json();
      })
      .then((data) => {
        const nextResults = Array.isArray(data.results) ? data.results : [];
        setResults(nextResults);
        setCachedSearchResults(q, nextResults);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '搜索失败');
      })
      .finally(() => setLoading(false));
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    runSearch(keyword);
  };

  const displayResults = useMemo<TVSearchDisplayItem[]>(() => {
    const groups = new Map<string, SearchResult[]>();
    const order: string[] = [];

    results.forEach((item) => {
      const key = `${normalizeTitle(item.title)}-${getResultType(
        item
      )}-${getValidYear(item)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)?.push(item);
    });

    return order.map((key) => {
      const group = groups.get(key) || [];
      const first = group[0];
      const sourceNames = Array.from(
        new Set(
          group.map((item) => item.source_name || item.source).filter(Boolean)
        )
      );
      const bestPoster =
        group.find((item) => item.poster)?.poster || first?.poster || '';
      const bestYear =
        group.find((item) => getValidYear(item) !== 'unknown')?.year ||
        first?.year ||
        '';
      const bestRemarks =
        group.find((item) => item.vod_remarks)?.vod_remarks ||
        first?.vod_remarks ||
        '';

      return {
        key,
        title: first?.title || '',
        poster: bestPoster,
        year: bestYear,
        vodRemarks: bestRemarks,
        sourceName: first?.source_name || first?.source || '',
        sourceNames,
        source: first?.source,
        id: first?.id,
        isAggregate: group.length > 1,
      };
    });
  }, [results]);

  useEffect(() => {
    if (loading || error || displayResults.length === 0) return;
    window.requestAnimationFrame(() => {
      firstResultRef.current?.focus({ preventScroll: true });
      firstResultRef.current?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
      });
    });
  }, [displayResults.length, error, loading]);

  return (
    <TVLayout>
      <div data-tv-focus-scope='active'>
        <section className='rounded-md border border-line bg-surface p-4 md:p-10 shadow-lg'>
          <h1 className='text-[28px] md:text-[32px] font-bold'>搜索</h1>
          <p className='mt-4 text-base text-muted'>
            搜索片名，选择影片查看详情
          </p>
          <form onSubmit={submit} className='mt-10 flex gap-4'>
            <label className='sr-only' htmlFor='tv-search'>
              搜索片名
            </label>
            <input
              id='tv-search'
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='搜索片名'
              className='h-12 min-w-0 flex-1 rounded-3xl border border-line bg-raised px-4 text-base text-fg outline-none placeholder:text-muted focus:border-fg tv-focusable'
            />
            <button
              type='submit'
              className='flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-3xl bg-fg px-4 text-base font-medium text-inverse outline-none transition hover:opacity-90 tv-focusable min-h-[44px] tm-press'
            >
              <Search className='h-5 w-5' /> 搜索
            </button>
          </form>
        </section>
        {(loading || searched || error) && (
          <section className='mx-auto mt-12'>
            <div className='mb-6 flex items-center justify-between gap-4'>
              <h2 className='text-[20px] md:text-[24px] font-medium'>
                {searched ? `“${searched}” 的搜索结果` : '搜索结果'}
              </h2>
              {loading && (
                <div
                  role='status'
                  aria-label='搜索中'
                  className='tm-skeleton h-6 w-24 shrink-0 rounded-lg'
                >
                  <span className='sr-only'>搜索中...</span>
                </div>
              )}
            </div>
            {error ? (
              <div
                role='alert'
                className='rounded-3xl border border-danger bg-raised p-4 md:p-8 text-base font-medium text-fg'
              >
                {error}
              </div>
            ) : loading ? null : displayResults.length === 0 ? (
              <div className='rounded-3xl border border-line bg-raised p-4 md:p-8 text-base font-medium text-muted'>
                未找到相关结果
              </div>
            ) : (
              <div className='grid grid-cols-2 gap-5 lg:grid-cols-4'>
                {displayResults.map((item, index) => (
                  <button
                    key={item.key}
                    ref={index === 0 ? firstResultRef : undefined}
                    onClick={() => router.push(getTVDetailUrl(item))}
                    className='tv-focusable cursor-pointer overflow-hidden rounded-3xl border border-line bg-raised text-left outline-none transition hover:bg-line min-h-[44px] tm-press'
                  >
                    <div className='aspect-[2/3] bg-surface'>
                      {item.poster ? (
                        <img
                          src={processImageUrl(item.poster)}
                          alt=''
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <div className='flex h-full items-center justify-center'>
                          <Film className='h-16 w-16 text-muted' />
                        </div>
                      )}
                    </div>
                    <div className='p-5'>
                      <div className='line-clamp-1 text-base font-medium text-fg'>
                        {item.title}
                      </div>
                      <div className='mt-2 line-clamp-1 text-sm font-medium text-muted'>
                        {item.isAggregate
                          ? `${item.sourceNames.length} 个播放源`
                          : item.sourceName}
                      </div>
                      <div className='mt-2 flex flex-wrap gap-2 text-base font-medium text-muted'>
                        {item.year && <span>{item.year}</span>}
                        {item.vodRemarks && <span>{item.vodRemarks}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {history.length > 0 && (
          <section className='mx-auto mt-12'>
            <h2 className='text-[20px] md:text-[24px] font-medium'>搜索历史</h2>
            <div className='mt-6 grid grid-cols-2 gap-4 md:grid-cols-4'>
              {history.slice(0, 20).map((item) => (
                <button
                  key={item}
                  onClick={() => runSearch(item)}
                  className='cursor-pointer rounded-3xl border border-line bg-raised px-6 py-5 text-base font-medium text-fg outline-none transition hover:bg-line tv-focusable min-h-[44px] tm-press'
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className='mx-auto mt-12'>
          <h2 className='text-[20px] md:text-[24px] font-medium'>热门搜索</h2>
          <div className='mt-6 grid grid-cols-2 gap-4 md:grid-cols-4'>
            {hot.map((item) => (
              <button
                key={item}
                onClick={() => runSearch(item)}
                className='cursor-pointer rounded-3xl border border-line bg-raised px-6 py-5 text-base font-medium text-fg outline-none transition hover:bg-line tv-focusable min-h-[44px] tm-press'
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>
    </TVLayout>
  );
}
