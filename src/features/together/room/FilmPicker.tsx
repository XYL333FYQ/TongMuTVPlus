'use client';

/*
 * 选片：搜影片，选一个片源后“现在一起看”或“加入片单”。
 */

import { Film, ListPlus, Loader2, Play, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import type { SearchResult } from '@/lib/types';

import {
  normalizeTitle,
  searchEverything,
} from '@/features/watch/media/catalog';

import { Dialog } from './RoomForm';
import { filmFromResult, FilmRef } from '../commands';

interface Group {
  key: string;
  title: string;
  year: string;
  poster: string;
  items: SearchResult[];
}

function group(results: SearchResult[]): Group[] {
  const map = new Map<string, Group>();
  for (const item of results) {
    const year = item.year && /^\d{4}$/.test(item.year) ? item.year : '';
    const key = `${normalizeTitle(item.title)}-${year}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      if (!existing.poster && item.poster) existing.poster = item.poster;
    } else
      map.set(key, {
        key,
        title: item.title,
        year,
        poster: item.poster || '',
        items: [item],
      });
  }
  return [...map.values()].slice(0, 40);
}

export default function FilmPicker(props: {
  canPlay: boolean;
  canQueue: boolean;
  initialQuery?: string;
  onPlay(film: FilmRef): Promise<void>;
  onQueue(film: FilmRef): Promise<void>;
  onClose(): void;
}) {
  const [query, setQuery] = useState(props.initialQuery || '');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => (results ? group(results) : []), [results]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = query.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    setSelected(null);
    try {
      const { results: found } = await searchEverything(text);
      setResults(
        found.filter(
          (item) =>
            item.episodes?.length ||
            item.source === 'openlist' ||
            item.source.startsWith('emby')
        )
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await run();
      props.onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作没有完成');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title='选片' onClose={props.onClose} wide>
      <form className='tm-t-search' onSubmit={search}>
        <Search size={18} aria-hidden='true' />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='搜影片、剧集、动漫'
          aria-label='搜索影片'
        />
        <button
          type='submit'
          className='tm-t-btn tm-t-btn-primary'
          disabled={loading || !query.trim()}
        >
          {loading ? <Loader2 size={16} className='tm-w-spin' /> : '搜索'}
        </button>
      </form>
      {error && (
        <p className='tm-t-error' role='alert'>
          {error}
        </p>
      )}
      {results && !groups.length && !loading && (
        <p className='tm-t-empty'>没有找到，换个关键词试试</p>
      )}
      <ul className='tm-t-results'>
        {groups.map((item) => (
          <li
            key={item.key}
            className='tm-t-result'
            data-open={selected === item.key ? 'true' : undefined}
          >
            <button
              type='button'
              className='tm-t-result-head'
              onClick={() =>
                setSelected(selected === item.key ? null : item.key)
              }
            >
              <span className='tm-t-result-poster'>
                {item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=''
                    loading='lazy'
                    referrerPolicy='no-referrer'
                  />
                ) : (
                  <Film size={20} />
                )}
              </span>
              <span className='tm-t-result-text'>
                <strong>{item.title}</strong>
                <small>
                  {[
                    item.year,
                    `${item.items.length} 个片源`,
                    item.items[0]?.type_name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
            </button>
            {selected === item.key && (
              <ul className='tm-t-result-sources'>
                {item.items.map((source) => {
                  const film = {
                    ...filmFromResult(source),
                    searchTitle: query.trim(),
                  };
                  return (
                    <li key={`${source.source}-${source.id}`}>
                      <span className='tm-t-result-source'>
                        {source.source_name || source.source}
                        <small>
                          {source.episodes?.length
                            ? `${source.episodes.length} 集`
                            : ''}
                        </small>
                      </span>
                      {props.canPlay && (
                        <button
                          type='button'
                          className='tm-t-btn tm-t-btn-primary'
                          disabled={busy}
                          onClick={() => void act(() => props.onPlay(film))}
                        >
                          <Play size={16} />
                          现在放
                        </button>
                      )}
                      {props.canQueue && (
                        <button
                          type='button'
                          className='tm-t-btn'
                          disabled={busy}
                          onClick={() => void act(() => props.onQueue(film))}
                        >
                          <ListPlus size={16} />
                          加入片单
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
