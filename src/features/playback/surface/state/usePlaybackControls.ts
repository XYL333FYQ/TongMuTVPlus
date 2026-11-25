'use client';

/*
 * 播放页状态（十）：换集、快捷键、播放器设置变化。
 */

'use client';

import { useEffect, useRef } from 'react';

import { isEpisodeHiddenByFilter } from '@/lib/episode-filter';
import { useLatest } from '@/hooks/useLatest';

import type { PlaybackEngine } from './usePlaybackEngine';
import type { PlaybackEpisodeFlow } from './usePlaybackEpisodeFlow';
import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackLoad } from './usePlaybackLoad';
import type { PlaybackSession0 } from './usePlaybackSession0';
import type { PlaybackSourceActions } from './usePlaybackSourceActions';
import type { PlaybackSourceState } from './usePlaybackSourceState';
import type { PlaybackStreams } from './usePlaybackStreams';
import { makeSaveCurrentPlayProgress } from '../../player/save-progress';

export function usePlaybackControls(
  vm: PlaybackSession0 &
    PlaybackIdentity &
    PlaybackEpisodeSync &
    PlaybackStreams &
    PlaybackSourceState &
    PlaybackEngine &
    PlaybackSourceActions &
    PlaybackLoad &
    PlaybackEpisodeFlow
) {
  const {
    artPlayerRef,
    playbackSession,
    detail,
    episodeFilterConfigRef,
    searchTitle,
    episodeProgressContentKey,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
    currentSourceRef,
    currentIdRef,
    videoTitleRef,
    detailRef,
    currentEpisodeIndexRef,
    totalEpisodes,
    lastSaveTimeRef,
    lastSavedPlayTimeRef,
    artRef,
    cleanupPlayer,
    primeEpisodeResumeState,
    prepareEpisodeSwitch,
  } = vm;
  // 处理集数切换
  const handleEpisodeChange = async (episodeNumber: number) => {
    if (episodeNumber < 0 || episodeNumber >= totalEpisodes) {
      return;
    }

    if (episodeNumber === currentEpisodeIndexRef.current) {
      return;
    }

    prepareEpisodeSwitch();
    primeEpisodeResumeState(episodeNumber);
    setCurrentEpisodeIndex(episodeNumber);
  };

  const handlePreviousEpisode = async () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      const targetIndex = idx - 1;
      prepareEpisodeSwitch();
      primeEpisodeResumeState(targetIndex);
      setCurrentEpisodeIndex(targetIndex);
    }
  };

  // 检查集数是否被过滤
  const isEpisodeFilteredByTitle = (title: string): boolean => {
    return isEpisodeHiddenByFilter(title, episodeFilterConfigRef.current);
  };

  const handleNextEpisode = async () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;

    if (!d || !d.episodes || idx >= d.episodes.length - 1) {
      return;
    }

    // 查找下一个未被过滤的集数
    let nextIdx = idx + 1;
    while (nextIdx < d.episodes.length) {
      const episodeTitle = d.episodes_titles?.[nextIdx];
      const isFiltered = episodeTitle && isEpisodeFilteredByTitle(episodeTitle);

      if (!isFiltered) {
        prepareEpisodeSwitch();
        primeEpisodeResumeState(nextIdx);
        setCurrentEpisodeIndex(nextIdx);
        return;
      }
      nextIdx++;
    }

    // 所有后续集数都被屏蔽
    if (artPlayerRef.current) {
      artPlayerRef.current.notice.show = '后续集数均已屏蔽';
      artPlayerRef.current.pause();
    }
  };

  // ---------------------------------------------------------------------------
  // 键盘快捷键
  // ---------------------------------------------------------------------------
  // 处理全局快捷键
  // 快捷键（内核 bindKeyboard）里要用的最新页面状态
  const keyboardRef = useRef<{
    active: () => boolean;
    previous: () => boolean;
    next: () => boolean;
  }>({
    active: () => false,
    previous: () => false,
    next: () => false,
  });
  keyboardRef.current = {
    // 整页时全页响应；小窗 / 收起时只在焦点落在播放器里时响应
    active: () =>
      playbackSession.presentation === 'full' ||
      !!artRef.current?.contains(document.activeElement),
    previous: () => {
      if (!detailRef.current || currentEpisodeIndexRef.current <= 0)
        return false;
      void handlePreviousEpisode();
      return true;
    },
    next: () => {
      const d = detailRef.current;
      if (!d || currentEpisodeIndexRef.current >= d.episodes.length - 1)
        return false;
      void handleNextEpisode();
      return true;
    },
  };

  // ---------------------------------------------------------------------------
  // 播放记录相关
  // ---------------------------------------------------------------------------
  // 保存播放进度
  const saveCurrentPlayProgress = makeSaveCurrentPlayProgress({
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
  });

  const saveCurrentPlayProgressLatest = useLatest(saveCurrentPlayProgress);
  const cleanupPlayerLatest = useLatest(cleanupPlayer);
  useEffect(() => {
    // 页面即将卸载时保存播放进度和清理资源
    const handleBeforeUnload = () => {
      saveCurrentPlayProgressLatest.current();
      cleanupPlayerLatest.current();
    };

    // 页面切到后台时保存播放进度（防息屏由 wakeLockPlugin 管）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden')
        saveCurrentPlayProgressLatest.current();
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    currentEpisodeIndex,
    detail,
    saveCurrentPlayProgressLatest,
    cleanupPlayerLatest,
  ]);

  // ---------------------------------------------------------------------------

  return {
    handleEpisodeChange,
    handlePreviousEpisode,
    isEpisodeFilteredByTitle,
    handleNextEpisode,
    keyboardRef,
    saveCurrentPlayProgress,
    saveCurrentPlayProgressLatest,
  };
}

export type PlaybackControls = ReturnType<typeof usePlaybackControls>;
