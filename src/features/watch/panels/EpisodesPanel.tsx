'use client';

/*
 * 选集：按 50 集分段，可正序 / 倒序、网格 / 列表；显示每集看过的进度；
 * 被“分集屏蔽”规则命中的集隐藏；可修正分集名称。
 */

import {
  ArrowDownUp,
  LayoutGrid,
  List,
  PencilLine,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { isEpisodeHiddenByFilter } from '@/lib/episode-filter';
import { loadAllLocalEpisodeProgressRecords } from '@/lib/episode-progress';
import type { EpisodeFilterConfig } from '@/lib/types';

import EpisodeFilterSettings from '@/components/EpisodeFilterSettings';
import EpisodeTitleCorrectDialog from '@/components/EpisodeTitleCorrectDialog';

const PAGE = 50;
const VIEW_KEY = 'tm-watch-episode-view';

export interface EpisodesPanelProps {
  total: number;
  titles: string[];
  names: Array<string | undefined>;
  current: number;
  progressKey: string | null;
  filter: EpisodeFilterConfig | null;
  videoTitle: string;
  disabled?: boolean;
  onSelect(index: number): void;
  onFilterChange(config: EpisodeFilterConfig): void;
  onToast(message: string, type: 'success' | 'error' | 'info'): void;
}

/** “第 01 集”“EP01”这类标题只显示数字，其它显示原标题 */
export function episodeLabel(title: string | undefined, index: number) {
  if (!title) return String(index + 1);
  const match =
    title.match(/^(?:第\s*)?0*(\d+)\s*(?:集|话|話)?$/) ||
    title.match(/^EP?\s*0*(\d+)$/i);
  return match ? match[1] : title;
}

export default function EpisodesPanel(props: EpisodesPanelProps) {
  const { total, current } = props;
  const [descending, setDescending] = useState(false);
  const [list, setList] = useState(false);
  const [page, setPage] = useState(() =>
    Math.floor(Math.max(0, current) / PAGE)
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [progress, setProgress] = useState<
    Record<string, { playTime: number; totalTime: number }>
  >({});

  useEffect(() => {
    try {
      setList(localStorage.getItem(VIEW_KEY) === 'list');
    } catch {
      // 忽略
    }
  }, []);
  useEffect(() => setPage(Math.floor(Math.max(0, current) / PAGE)), [current]);
  useEffect(() => {
    setProgress(loadAllLocalEpisodeProgressRecords(props.progressKey));
  }, [props.progressKey, current]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const indexes = useMemo(() => {
    const start = page * PAGE;
    const items = Array.from(
      { length: Math.min(PAGE, total - start) },
      (_, i) => start + i
    ).filter(
      (index) =>
        !isEpisodeHiddenByFilter(props.titles[index] || '', props.filter)
    );
    return descending ? items.reverse() : items;
  }, [page, total, descending, props.titles, props.filter]);

  const toggleView = () =>
    setList((value) => {
      try {
        localStorage.setItem(VIEW_KEY, value ? 'grid' : 'list');
      } catch {
        // 忽略
      }
      return !value;
    });

  const richList = list || props.names.some(Boolean);

  return (
    <div className='tm-w-episodes'>
      <div className='tm-w-toolbar'>
        <span className='tm-w-toolbar-title'>共 {total} 集</span>
        <div className='tm-w-toolbar-actions'>
          <button
            type='button'
            className='tm-w-icon'
            onClick={() => setDescending((v) => !v)}
            aria-label={descending ? '改为正序' : '改为倒序'}
            title={descending ? '倒序' : '正序'}
          >
            <ArrowDownUp size={16} />
          </button>
          <button
            type='button'
            className='tm-w-icon'
            onClick={toggleView}
            aria-label={list ? '网格显示' : '列表显示'}
            title={list ? '网格' : '列表'}
          >
            {list ? <LayoutGrid size={16} /> : <List size={16} />}
          </button>
          <button
            type='button'
            className='tm-w-icon'
            onClick={() => setFilterOpen(true)}
            aria-label='分集屏蔽规则'
            title='屏蔽规则'
          >
            <SlidersHorizontal size={16} />
          </button>
          {total > 1 && (
            <button
              type='button'
              className='tm-w-icon'
              onClick={() => setCorrectOpen(true)}
              aria-label='修正分集名称'
              title='修正分集名称'
            >
              <PencilLine size={16} />
            </button>
          )}
        </div>
      </div>

      {pages > 1 && (
        <div className='tm-w-ranges' role='tablist' aria-label='分段'>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type='button'
              role='tab'
              aria-selected={i === page}
              className='tm-w-range'
              onClick={() => setPage(i)}
            >
              {i * PAGE + 1}–{Math.min(total, (i + 1) * PAGE)}
            </button>
          ))}
        </div>
      )}

      <div className={richList ? 'tm-w-episode-list' : 'tm-w-episode-grid'}>
        {indexes.map((index) => {
          const record = progress[String(index)];
          const ratio =
            record && record.totalTime > 0
              ? Math.min(1, record.playTime / record.totalTime)
              : 0;
          const label = episodeLabel(props.titles[index], index);
          const name = props.names[index];
          return (
            <button
              key={index}
              type='button'
              className='tm-w-episode'
              aria-current={index === current ? 'true' : undefined}
              disabled={props.disabled && index !== current}
              onClick={() => props.onSelect(index)}
              title={name || props.titles[index] || `第 ${index + 1} 集`}
            >
              {richList ? (
                <>
                  <span className='tm-w-episode-no'>
                    {/^\d+$/.test(label) ? label.padStart(2, '0') : index + 1}
                  </span>
                  <span className='tm-w-episode-name'>
                    {name || (/^\d+$/.test(label) ? `第 ${label} 集` : label)}
                  </span>
                </>
              ) : (
                <span className='tm-w-episode-no'>{label}</span>
              )}
              {ratio > 0.02 && (
                <span
                  className='tm-w-episode-progress'
                  style={{ transform: `scaleX(${ratio})` }}
                  aria-hidden='true'
                />
              )}
            </button>
          );
        })}
      </div>

      <EpisodeFilterSettings
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onConfigUpdate={props.onFilterChange}
        onShowToast={props.onToast}
      />
      <EpisodeTitleCorrectDialog
        isOpen={correctOpen}
        onClose={() => setCorrectOpen(false)}
        videoTitle={props.videoTitle}
        totalEpisodes={total}
      />
    </div>
  );
}
