/*
 * 自己看：保存播放记录（本机和服务器）。
 */

import type { MutableRefObject } from 'react';

import { isAnimeCategoryText } from '@/lib/anime-keyword-expr';
import { savePlayRecord } from '@/lib/db.client';
import { saveLocalEpisodeProgress } from '@/lib/episode-progress';
import { SearchResult } from '@/lib/types';

import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface SaveProgressContext {
  artPlayerRef: MutableRefObject<Art | null>;
  currentEpisodeIndexRef: MutableRefObject<number>;
  currentIdRef: MutableRefObject<string>;
  currentSourceRef: MutableRefObject<string>;
  detailRef: MutableRefObject<SearchResult | null>;
  episodeProgressContentKey: string | null;
  lastSaveTimeRef: MutableRefObject<number>;
  lastSavedPlayTimeRef: MutableRefObject<number | null>;
  searchTitle: string;
  videoTitleRef: MutableRefObject<string>;
}

export function makeSaveCurrentPlayProgress(ctx: SaveProgressContext) {
  const {
    artPlayerRef,
    currentEpisodeIndexRef,
    currentIdRef,
    currentSourceRef,
    detailRef,
    episodeProgressContentKey,
    lastSaveTimeRef,
    lastSavedPlayTimeRef,
    searchTitle,
    videoTitleRef,
  } = ctx;
  return async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;
    const playTime = Math.floor(currentTime);

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    if (lastSavedPlayTimeRef.current === playTime) {
      return;
    }

    try {
      saveLocalEpisodeProgress(
        episodeProgressContentKey,
        currentEpisodeIndexRef.current,
        currentTime,
        duration
      );

      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: playTime,
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
        is_anime: isAnimeCategoryText(
          detailRef.current?.type_name,
          detailRef.current?.class
        ),
      });

      lastSavedPlayTimeRef.current = playTime;
      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };
}
