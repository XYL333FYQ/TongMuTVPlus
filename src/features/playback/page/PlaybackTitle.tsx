'use client';

import './PlaybackTitle.css';

import type { SearchResult } from '@/lib/types';

import { seriesStatus } from '../lib/series-status';

interface PlaybackTitleProps {
  detail: SearchResult | null;
  videoTitle: string;
  videoYear: string;
  /** 豆瓣发行年份（优先于片源给的年份） */
  doubanYear: string;
  doubanRating: { value: number } | null;
  /** 标题后面的“ > 第 N 集”；null 表示不显示 */
  episodeLabel: string | null;
  sourceBadge: 'local' | 'offline' | null;
  /** 有剧照背景时文字用浅色 */
  onArt: boolean;
  totalEpisodes: number;
}

/** 播放器上方：片名、集数和一行关键信息 */
export default function PlaybackTitle({
  detail,
  videoTitle,
  videoYear,
  doubanYear,
  doubanRating,
  episodeLabel,
  sourceBadge,
  onArt,
  totalEpisodes,
}: PlaybackTitleProps) {
  return (
    <div className='tm-ptitle-div-1 tm-solo-title'>
      <h1
        className={`tm-ptitle-h1-1 ${
          onArt ? 'tm-ptitle-h1-2' : 'tm-ptitle-h1-3'
        }`}
      >
        <span>
          {videoTitle || '影片标题'}
          {episodeLabel !== null && (
            <span className={onArt ? 'tm-ptitle-span-1' : 'tm-ptitle-span-2'}>
              {` > ${episodeLabel}`}
            </span>
          )}
        </span>
        {/* 完结状态标识 */}
        {detail &&
          totalEpisodes > 1 &&
          (() => {
            const status = seriesStatus(detail);
            if (status === 'unknown') return null;

            return (
              <span className='tm-ptitle-span-3'>
                {status === 'completed' ? '已完结' : '连载中'}
              </span>
            );
          })()}
        {sourceBadge && (
          <span className='tm-ptitle-span-3'>
            {sourceBadge === 'local' ? '本地播放' : '离线播放'}
          </span>
        )}
      </h1>
      {/* 一行关键信息：年份 / 片源 / 类型 / 集数 / 评分，不用滚到页面下方才知道 */}
      {(doubanYear ||
        detail?.year ||
        videoYear ||
        detail?.source_name ||
        detail?.type_name ||
        totalEpisodes > 1 ||
        (doubanRating && doubanRating.value > 0)) && (
        <div className='tm-ptitle-div-2'>
          {(doubanYear || detail?.year || videoYear) && (
            <span className='tm-ptitle-span-4'>
              {doubanYear || detail?.year || videoYear}
            </span>
          )}
          {detail?.type_name && (
            <span className='tm-ptitle-span-4'>{detail.type_name}</span>
          )}
          {totalEpisodes > 1 && (
            <span className='tm-ptitle-span-4'>共 {totalEpisodes} 集</span>
          )}
          {doubanRating && doubanRating.value > 0 && (
            <span className='tm-ptitle-span-4'>
              豆瓣 {doubanRating.value.toFixed(1)}
            </span>
          )}
          {detail?.source_name && (
            <span className='tm-ptitle-span-5'>
              片源 · {detail.source_name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
