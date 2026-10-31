/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { Search, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  EpisodeTitleCorrection,
  getEpisodeTitleCorrection,
  setEpisodeTitleCorrection,
} from '@/lib/episode-title-correction';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { processImageUrl } from '@/lib/utils';

import ModalLayer from '@/components/feedback/ModalLayer';

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
}

interface TMDBSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

interface EpisodeTitleCorrectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  totalEpisodes: number;
}

export default function EpisodeTitleCorrectDialog({
  isOpen,
  onClose,
  videoTitle,
  totalEpisodes,
}: EpisodeTitleCorrectDialogProps) {
  const [correction, setCorrection] = useState<EpisodeTitleCorrection>({});

  // TMDB 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState<TMDBResult | null>(null);
  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [showSeasonSelection, setShowSeasonSelection] = useState(false);

  // 打开时载入当前标题的矫正配置并重置搜索状态
  useEffect(() => {
    if (!isOpen) return;
    setCorrection(getEpisodeTitleCorrection(videoTitle));
    setSearchQuery(videoTitle || '');
    setResults([]);
    setError('');
    setSelectedResult(null);
    setSeasons([]);
    setShowSeasonSelection(false);
  }, [isOpen, videoTitle]);

  // 合并写入并刷新本地状态
  const update = (patch: Partial<EpisodeTitleCorrection>) => {
    setEpisodeTitleCorrection(videoTitle, patch);
    setCorrection(getEpisodeTitleCorrection(videoTitle));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('请输入搜索关键词');
      return;
    }
    setSearching(true);
    setError('');
    setResults([]);
    setShowSeasonSelection(false);
    setSelectedResult(null);
    try {
      const resp = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(searchQuery)}`
      );
      if (!resp.ok) throw new Error('搜索失败');
      const data = await resp.json();
      if (data.success && data.results) {
        // 分集名矫正只针对电视剧
        const tvOnly = (data.results as TMDBResult[]).filter(
          (r) => r.media_type === 'tv'
        );
        setResults(tvOnly);
        if (tvOnly.length === 0) setError('未找到匹配的电视剧');
      } else {
        setError('搜索失败');
      }
    } catch (err) {
      console.error('TMDB 搜索失败:', err);
      setError('搜索失败，请重试');
    } finally {
      setSearching(false);
    }
  };

  const fetchSeasons = async (tvId: number): Promise<TMDBSeason[]> => {
    setLoadingSeasons(true);
    setError('');
    try {
      const resp = await fetch(`/api/tmdb/seasons?tvId=${tvId}`);
      if (!resp.ok) throw new Error('获取季度列表失败');
      const data = await resp.json();
      if (data.success && data.seasons) return data.seasons as TMDBSeason[];
      setError('获取季度列表失败');
      return [];
    } catch (err) {
      console.error('获取季度列表失败:', err);
      setError('获取季度列表失败，请重试');
      return [];
    } finally {
      setLoadingSeasons(false);
    }
  };

  // 选中搜索结果：拉季度列表，单季直接应用，多季进入季度选择
  const handleSelectResult = async (result: TMDBResult) => {
    setSelectedResult(result);
    const list = await fetchSeasons(result.id);
    // 过滤掉「特别篇 season 0」等非正片季
    const normal = list.filter((s) => s.season_number >= 1);
    if (normal.length <= 1) {
      applyTmdb(result.id, normal[0]?.season_number ?? 1);
    } else {
      setSeasons(normal);
      setShowSeasonSelection(true);
    }
  };

  // 写入选定的 TMDB 剧集与季，并切回主界面
  const applyTmdb = (tmdbId: number, season: number) => {
    update({ tmdbId, season, preferDanmaku: undefined });
    setShowSeasonSelection(false);
    setResults([]);
    setSelectedResult(null);
  };

  const clearTmdb = () => update({ tmdbId: undefined, season: undefined });

  if (!isOpen) return null;

  const disabled = !!correction.disabled;
  const preferDanmaku = !!correction.preferDanmaku;
  const hasTmdb = typeof correction.tmdbId === 'number';

  return createPortal(
    <ModalLayer label='手动矫正标题' onClose={onClose}>
      <div className='tm-modal w-full max-w-md max-h-[85dvh] overflow-hidden flex flex-col rounded-2xl bg-surface shadow-xl'>
        {/* 头部 */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-line'>
          <span className='text-base font-medium text-fg'>手动矫正标题</span>
          <button
            className='p-1 rounded-md text-muted hover:text-fg hover:bg-line transition-colors min-h-[44px] tm-press'
            onClick={onClose}
            aria-label='关闭'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-5 py-4 space-y-5'>
          {/* 禁用本剧集 */}
          <label className='flex items-start justify-between gap-3 cursor-pointer'>
            <div className='min-w-0'>
              <div className='text-sm font-medium text-fg'>禁用本剧集</div>
              <p className='mt-1 text-[13px] text-muted'>
                仅对本剧生效：不获取分集名，保持数字网格。
              </p>
            </div>
            <SwitchButton
              checked={disabled}
              label='禁用本剧集'
              disabled={!videoTitle}
              onClick={() => update({ disabled: !disabled })}
            />
          </label>

          {!disabled && (
            <>
              {/* 弹幕优先（不用搜 TMDB） */}
              <label className='flex items-start justify-between gap-3 cursor-pointer'>
                <div className='min-w-0'>
                  <div className='text-sm font-medium text-fg'>弹幕优先</div>
                  <p className='mt-1 text-[13px] text-muted'>
                    直接用弹幕分集名，不搜索、不使用 TMDB。
                  </p>
                </div>
                <SwitchButton
                  checked={preferDanmaku}
                  label='弹幕优先'
                  disabled={!videoTitle}
                  onClick={() =>
                    update({
                      preferDanmaku: !preferDanmaku,
                      // 打开弹幕优先时清掉手动 TMDB 选择
                      tmdbId: !preferDanmaku ? undefined : correction.tmdbId,
                      season: !preferDanmaku ? undefined : correction.season,
                    })
                  }
                />
              </label>

              {/* 指定 TMDB */}
              {!preferDanmaku && (
                <div className='space-y-2'>
                  <div className='text-sm font-medium text-fg'>
                    指定 TMDB 剧集
                  </div>
                  {hasTmdb ? (
                    <div className='flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2'>
                      <span className='text-sm text-fg'>
                        已指定：TMDB #{correction.tmdbId} · 第{' '}
                        {correction.season} 季
                      </span>
                      <button
                        className='text-[13px] text-fg hover:text-fg min-h-[44px] tm-press'
                        onClick={clearTmdb}
                      >
                        清除
                      </button>
                    </div>
                  ) : (
                    <TmdbSearchArea
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      searching={searching}
                      error={error}
                      results={results}
                      seasons={seasons}
                      loadingSeasons={loadingSeasons}
                      showSeasonSelection={showSeasonSelection}
                      selectedResult={selectedResult}
                      onSearch={handleSearch}
                      onSelectResult={handleSelectResult}
                      onSelectSeason={(s) =>
                        selectedResult &&
                        applyTmdb(selectedResult.id, s.season_number)
                      }
                      onBack={() => setShowSeasonSelection(false)}
                    />
                  )}
                </div>
              )}

              {/* 起始集数 */}
              <div className='space-y-1'>
                <label
                  htmlFor='episode-title-start-episode'
                  className='block text-sm font-medium text-fg'
                >
                  起始集数
                </label>
                <p className='text-[13px] text-muted'>
                  视频第 1 集对应 TMDB 的第几集。TMDB
                  把多季合在一季连续编号（本剧其实是第 2/3
                  季）时，用它对齐，例如填 13。
                </p>
                <input
                  id='episode-title-start-episode'
                  type='number'
                  min={1}
                  value={correction.startEpisode ?? ''}
                  placeholder='1'
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    update({
                      startEpisode: Number.isFinite(v) && v > 1 ? v : undefined,
                    });
                  }}
                  className='w-28 px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
                {totalEpisodes > 0 && (
                  <p className='text-[13px] text-muted'>
                    本视频共 {totalEpisodes} 集
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalLayer>,
    document.body
  );
}

// 开关按钮
function SwitchButton({
  checked,
  disabled,
  onClick,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className='tm-switch-btn'
    >
      <span className='tm-switch-btn-thumb' aria-hidden='true' />
    </button>
  );
}

// TMDB 搜索 + 季度选择
function TmdbSearchArea({
  searchQuery,
  setSearchQuery,
  searching,
  error,
  results,
  seasons,
  loadingSeasons,
  showSeasonSelection,
  selectedResult,
  onSearch,
  onSelectResult,
  onSelectSeason,
  onBack,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searching: boolean;
  error: string;
  results: TMDBResult[];
  seasons: TMDBSeason[];
  loadingSeasons: boolean;
  showSeasonSelection: boolean;
  selectedResult: TMDBResult | null;
  onSearch: () => void;
  onSelectResult: (r: TMDBResult) => void;
  onSelectSeason: (s: TMDBSeason) => void;
  onBack: () => void;
}) {
  if (showSeasonSelection) {
    return (
      <div>
        <button
          onClick={onBack}
          className='mb-2 text-sm text-fg hover:text-fg min-h-[44px] tm-press'
        >
          ← 返回搜索结果
        </button>
        {selectedResult && (
          <div className='mb-2 text-sm text-muted'>
            {selectedResult.title || selectedResult.name} · 请选择季度
          </div>
        )}
        {loadingSeasons ? (
          <div className='py-6 text-center text-sm text-muted'>
            加载季度中...
          </div>
        ) : (
          <div className='space-y-2 max-h-64 overflow-y-auto'>
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSeason(s)}
                className='w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-line hover:bg-line transition-colors text-left min-h-[44px] tm-press'
              >
                <span className='text-sm text-fg'>{s.name}</span>
                <span className='text-[13px] text-muted'>
                  {s.episode_count} 集
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className='flex gap-2'>
        <input
          type='text'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder='搜索剧名'
          aria-label='搜索剧名'
          className='flex-1 px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
        />
        <button
          onClick={onSearch}
          disabled={searching}
          aria-label='搜索剧名'
          className='px-3 py-2 bg-fg hover:opacity-90 text-inverse rounded-lg transition-colors disabled:bg-surface flex items-center min-h-[44px] tm-press'
        >
          <Search className='w-4 h-4' />
        </button>
      </div>
      {error && <p className='mt-2 text-sm text-fg'>{error}</p>}
      {results.length > 0 && (
        <div className='mt-2 space-y-2 max-h-64 overflow-y-auto'>
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectResult(r)}
              disabled={loadingSeasons}
              className='w-full flex gap-3 p-2 rounded-lg border border-line hover:bg-line transition-colors text-left disabled:opacity-50 min-h-[44px] tm-press'
            >
              <div className='flex-shrink-0 w-10 h-14 relative rounded overflow-hidden bg-raised'>
                {r.poster_path && (
                  <Image
                    src={processImageUrl(getTMDBImageUrl(r.poster_path))}
                    alt={r.title || r.name || ''}
                    fill
                    className='object-cover'
                    referrerPolicy='no-referrer'
                  />
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-medium text-fg truncate'>
                  {r.title || r.name}
                </div>
                <div className='text-[13px] text-muted mt-0.5'>
                  {r.first_air_date?.split('-')[0] || '未知'} · 评分{' '}
                  {r.vote_average.toFixed(1)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
