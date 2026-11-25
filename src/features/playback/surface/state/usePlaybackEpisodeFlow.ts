'use client';

/*
 * 播放页状态（九）：详情 / 集数变了重新取地址、换源。
 */

'use client';

import { useEffect } from 'react';

import { generateStorageKey, getAllPlayRecords } from '@/lib/db.client';
import {
  loadLocalEpisodeProgress,
  saveLocalEpisodeProgress,
} from '@/lib/episode-progress';
import { logger } from '@/lib/logger';
import { useLatest } from '@/hooks/useLatest';

import { type SourceSubtitle } from '@/features/player';

import type { PlaybackEngine } from './usePlaybackEngine';
import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackLoad } from './usePlaybackLoad';
import type { PlaybackSession0 } from './usePlaybackSession0';
import type { PlaybackSourceActions } from './usePlaybackSourceActions';
import type { PlaybackSourceState } from './usePlaybackSourceState';
import type { PlaybackStreams } from './usePlaybackStreams';
import { makeHandleSourceChange } from '../../sources/change-source';

export function usePlaybackEpisodeFlow(
  vm: PlaybackSession0 &
    PlaybackIdentity &
    PlaybackEpisodeSync &
    PlaybackStreams &
    PlaybackSourceState &
    PlaybackEngine &
    PlaybackSourceActions &
    PlaybackLoad
) {
  const {
    artPlayerRef,
    playbackSession,
    commitPlaybackHref,
    setError,
    detail,
    setDetail,
    skipConfigRef,
    videoTitle,
    setVideoTitle,
    setVideoYear,
    setVideoCover,
    setVideoDoubanId,
    setCorrectedDesc,
    setCurrentSource,
    setCurrentId,
    isLazyDetailSource,
    searchTitle,
    searchType,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    episodeProgressContentKey,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
    suppressPlayRecordJumpOnNextEpisodeChangeRef,
    currentSourceRef,
    currentIdRef,
    currentEpisodeIndexRef,
    isSourceChangingRef,
    proxyAttemptedRef,
    setCorsFailedUrl,
    setVideoError,
    setVideoLoadingStage,
    setIsVideoLoading,
    setSourceProxyMode,
    resumeTimeRef,
    lastVolumeRef,
    availableSources,
    subtitles,
    fetchCurrentSourceVideoInfo,
  } = vm;
  // 监听 detail 和 currentEpisodeIndex 变化，自动获取视频信息
  const fetchCurrentSourceVideoInfoLatest = useLatest(
    fetchCurrentSourceVideoInfo
  );
  useEffect(() => {
    if (detail && detail.episodes && detail.episodes.length > 0) {
      fetchCurrentSourceVideoInfoLatest.current();
    }
  }, [detail, currentEpisodeIndex, fetchCurrentSourceVideoInfoLatest]);

  // 监听 detail 和 currentEpisodeIndex 变化，动态更新字幕
  const subtitlesLatest = useLatest(subtitles);
  useEffect(() => {
    if (!artPlayerRef.current || !detail) return;

    subtitlesLatest.current.setTracks(
      (detail.subtitles?.[currentEpisodeIndex] || []) as SourceSubtitle[],
      String(currentEpisodeIndex)
    );
  }, [detail, currentEpisodeIndex, subtitlesLatest, artPlayerRef]);

  const getSourceSwitchResumeTime = async (
    episodeIndex: number,
    currentPlayTime: number
  ): Promise<number | null> => {
    if (currentPlayTime > 1) {
      return currentPlayTime;
    }

    if (!currentSourceRef.current || !currentIdRef.current) {
      return null;
    }

    try {
      const allRecords = await getAllPlayRecords();
      const currentRecord =
        allRecords[
          generateStorageKey(currentSourceRef.current, currentIdRef.current)
        ];

      if (
        currentRecord &&
        currentRecord.index - 1 === episodeIndex &&
        currentRecord.play_time > 1
      ) {
        return currentRecord.play_time;
      }
    } catch (error) {
      logger.warn('[Play] Failed to read source-switch play record:', error);
    }

    return loadLocalEpisodeProgress(episodeProgressContentKey, episodeIndex);
  };

  // 处理换源
  const handleSourceChange = makeHandleSourceChange({
    artPlayerRef,
    availableSources,
    commitPlaybackHref,
    currentEpisodeIndexRef,
    currentIdRef,
    currentSourceRef,
    detail,
    getSourceSwitchResumeTime,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    isLazyDetailSource,
    isSourceChangingRef,
    playbackSession,
    proxyAttemptedRef,
    resumeTimeRef,
    searchTitle,
    searchType,
    setCorrectedDesc,
    setCorsFailedUrl,
    setCurrentEpisodeIndex,
    setCurrentId,
    setCurrentSource,
    setDetail,
    setError,
    setIsVideoLoading,
    setSourceProxyMode,
    setVideoCover,
    setVideoDoubanId,
    setVideoError,
    setVideoLoadingStage,
    setVideoTitle,
    setVideoYear,
    skipConfigRef,
    videoTitle,
  });

  // ---------------------------------------------------------------------------
  // 集数切换
  // ---------------------------------------------------------------------------
  const saveCurrentEpisodeLocalProgressOnly = () => {
    if (!artPlayerRef.current) {
      return;
    }

    const currentTime = artPlayerRef.current.currentTime || 0;
    const duration = artPlayerRef.current.duration || 0;

    if (currentTime < 1 || !duration) {
      return;
    }

    try {
      saveLocalEpisodeProgress(
        episodeProgressContentKey,
        currentEpisodeIndexRef.current,
        currentTime,
        duration
      );
    } catch (error) {
      logger.warn(
        '[Play] Failed to save local episode progress before episode switch:',
        error
      );
    }
  };

  const primeEpisodeResumeState = (targetEpisodeIndex: number) => {
    if (!currentSourceRef.current || !currentIdRef.current) {
      resumeTimeRef.current = null;
      return;
    }

    // 切集路径只读取本地单集进度，避免阻塞式读取全局播放记录/远端数据库。
    // 首次进入页面的全局播放记录恢复逻辑保持不变。
    resumeTimeRef.current = loadLocalEpisodeProgress(
      episodeProgressContentKey,
      targetEpisodeIndex
    );
  };

  const prepareEpisodeSwitch = () => {
    if (artPlayerRef.current) {
      lastVolumeRef.current =
        artPlayerRef.current.volume || lastVolumeRef.current;

      saveCurrentEpisodeLocalProgressOnly();
    }

    suppressPlayRecordJumpOnNextEpisodeChangeRef.current = true;
    setVideoLoadingStage('episodeChanging');
    setIsVideoLoading(true);
    setVideoError(null);
  };

  return {
    fetchCurrentSourceVideoInfoLatest,
    subtitlesLatest,
    getSourceSwitchResumeTime,
    handleSourceChange,
    saveCurrentEpisodeLocalProgressOnly,
    primeEpisodeResumeState,
    prepareEpisodeSwitch,
  };
}

export type PlaybackEpisodeFlow = ReturnType<typeof usePlaybackEpisodeFlow>;
