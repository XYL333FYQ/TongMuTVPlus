'use client';

import { Film, Link2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { base58Encode } from '@/lib/utils';

type FilmChoice = {
  id: string;
  title: string;
  source: string;
  source_name?: string;
  year?: string;
};

export default function RoomFilmPicker({
  busy,
  onAdd,
  initialQuery = '',
}: {
  busy: boolean;
  onAdd: (href: string) => Promise<void>;
  initialQuery?: string;
}) {
  const [mode, setMode] = useState<'catalog' | 'direct'>('catalog');
  const [query, setQuery] = useState(initialQuery);
  const [title, setTitle] = useState('');
  const [results, setResults] = useState<FilmChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const searchRequest = useRef<AbortController | null>(null);
  const searchSequence = useRef(0);
  useEffect(
    () => () => {
      searchSequence.current += 1;
      searchRequest.current?.abort();
    },
    []
  );
  const changeMode = (next: 'catalog' | 'direct') => {
    // 模式独立，迟到的搜索结果不能覆盖新模式或重新锁住提交按钮。
    searchSequence.current += 1;
    searchRequest.current?.abort();
    searchRequest.current = null;
    setMode(next);
    setQuery('');
    setError('');
    setResults([]);
    setSearching(false);
    setSearched(false);
  };
  const search = async () => {
    setError('');
    if (mode === 'direct') {
      try {
        const url = new URL(query.trim());
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          !/\.(mp4|m3u8)$/i.test(url.pathname)
        )
          throw new Error(
            '请使用完整的 MP4 或 M3U8 直链。电影网页地址需要独立解析能力。'
          );
        await onAdd(
          `/play?${new URLSearchParams({
            source: 'directplay',
            id: base58Encode(url.href),
            title: title || '分享的影片',
            episode: '1',
          })}`
        );
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : '地址无效');
      }
      return;
    }
    searchRequest.current?.abort();
    const request = new AbortController();
    searchRequest.current = request;
    const sequence = ++searchSequence.current;
    setSearching(true);
    setSearched(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}`,
        { cache: 'no-store', signal: request.signal }
      );
      if (!response.ok)
        throw new Error('搜索失败，请检查登录和站长配置的数据源');
      const data = await response.json();
      if (sequence === searchSequence.current && !request.signal.aborted)
        setResults(data.results || []);
    } catch (failure) {
      if (sequence === searchSequence.current && !request.signal.aborted)
        setError(failure instanceof Error ? failure.message : '搜索失败');
    } finally {
      if (sequence === searchSequence.current) {
        searchRequest.current = null;
        setSearching(false);
      }
    }
  };
  return (
    <div className='tm-room-picker'>
      <div className='tm-room-picker-tabs'>
        <button
          aria-pressed={mode === 'catalog'}
          onClick={() => changeMode('catalog')}
        >
          <Film size={15} />
          影视库
        </button>
        <button
          aria-pressed={mode === 'direct'}
          onClick={() => changeMode('direct')}
        >
          <Link2 size={15} />
          视频直链
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        {mode === 'direct' && (
          <label>
            影片名称
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={240}
              placeholder='给朋友一个好认的名字'
            />
          </label>
        )}
        <label>
          {mode === 'catalog' ? '搜索影片' : 'MP4 / M3U8 地址'}
          <input
            required
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === 'catalog'
                ? '电影名、剧集名…'
                : 'https://…/video.m3u8?token=…'
            }
          />
        </label>
        <button
          className='tm-room-primary'
          disabled={busy || searching || !query.trim()}
        >
          {searching ? '正在搜索…' : mode === 'catalog' ? '搜索' : '加入片单'}
        </button>
      </form>
      <p>加入片单不会切换正在播放的影片。播放由当前主持确认。</p>
      {error && <p role='alert'>{error}</p>}
      <div className='tm-room-picker-results'>
        {results.map((film, index) => (
          <div key={`${film.source}:${film.id}:${index}`}>
            <div>
              <h3>{film.title}</h3>
              <p>
                {film.year || '年份未知'} · {film.source_name || film.source}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                onAdd(
                  `/play?${new URLSearchParams({
                    source: film.source,
                    id: String(film.id),
                    title: film.title,
                    year: film.year || '',
                    episode: '1',
                  })}`
                )
              }
              aria-label={`将${film.title}加入片单`}
            >
              <Plus size={18} />
            </button>
          </div>
        ))}
        {searched && !searching && !results.length && !error && (
          <p>没有找到结果。可以换个关键词，或请站长检查数据源。</p>
        )}
      </div>
    </div>
  );
}
