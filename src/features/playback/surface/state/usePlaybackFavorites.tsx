'use client';

/*
 * 播放页状态（十一）：收藏、卸载时清理播放器。
 */

'use client';

import { useEffect } from 'react';

import { logger } from '@/lib/logger';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { processImageUrl } from '@/lib/utils';
import { useLatest } from '@/hooks/useLatest';

import type { PlaybackControls } from './usePlaybackControls';
import type { PlaybackEngine } from './usePlaybackEngine';
import type { PlaybackEpisodeFlow } from './usePlaybackEpisodeFlow';
import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackLoad } from './usePlaybackLoad';
import type { PlaybackSession0 } from './usePlaybackSession0';
import type { PlaybackSourceActions } from './usePlaybackSourceActions';
import type { PlaybackSourceState } from './usePlaybackSourceState';
import type { PlaybackStreams } from './usePlaybackStreams';
import { useFavorite } from '../useFavorite';
import {
  applyCorrection,
  applyCorrectionsToSources,
  getXiaoyaCorrection,
} from '../../lib/xiaoya-correction';
import { makeLoadPlayer } from '../../player/load-player';

export function usePlaybackFavorites(
  vm: PlaybackSession0 &
    PlaybackIdentity &
    PlaybackEpisodeSync &
    PlaybackStreams &
    PlaybackSourceState &
    PlaybackEngine &
    PlaybackSourceActions &
    PlaybackLoad &
    PlaybackEpisodeFlow &
    PlaybackControls
) {
  const {
    artPlayerRef,
    searchParams,
    loading,
    setError,
    detail,
    setIsWebFullscreen,
    skipConfigRef,
    setQuickForwardSeconds,
    quickForwardSecondsRef,
    setSeekStepSeconds,
    seekStepSecondsRef,
    blockAdEnabled,
    setBlockAdEnabled,
    blockAdEnabledRef,
    danmakuHeatmapDisabledRef,
    setDanmakuHeatmapEnabled,
    danmakuHeatmapEnabledRef,
    lastSkipCheckRef,
    anime4k,
    danmaku,
    setShowDanmakuFilterSettings,
    videoTitle,
    setVideoTitle,
    videoCover,
    setVideoCover,
    setVideoDoubanId,
    setCorrectedDesc,
    currentSource,
    currentId,
    isLazyDetailSource,
    searchTitle,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
    nextEpisodeDanmakuPreloadTriggeredRef,
    nextEpisodePreCacheTriggeredRef,
    playRecordJumpInitialCheckRef,
    playRecordJumpLayerRef,
    playRecordJumpDismissedRef,
    currentSourceRef,
    currentIdRef,
    videoTitleRef,
    detailRef,
    currentEpisodeIndexRef,
    totalEpisodes,
    videoUrl,
    isHarmonyOS,
    harmonyHlsPlaybackMode,
    nativeHlsAdBlockEnabled,
    proxyAttemptedRef,
    setCorsFailedUrl,
    setVideoError,
    setIsVideoLoading,
    supportsNativeHls,
    netdiskHlsPlaybackMode,
    videoQualities,
    linkRefresher,
    videoMediaTypeRef,
    playerEpisodeLabel,
    seekQuickForward,
    isPlaybackThumbnailDisabled,
    resumeTimeRef,
    resumePlayingAfterHlsModeSwitchRef,
    lastVolumeRef,
    setAvailableSources,
    setPlayerReady,
    lastSaveTimeRef,
    artRef,
    restoreWebFullscreenOnReadyRef,
    watchPlayerRef,
    stopKeyboardRef,
    activeAdBlockRef,
    subtitles,
    episodeSubtitles,
    releasePlayerResources,
    cleanupPlayer,
    handleSkipConfigChange,
    isEpisodeFilteredByTitle,
    handleNextEpisode,
    keyboardRef,
    saveCurrentPlayProgress,
  } = vm;
  // 收藏相关
  // ---------------------------------------------------------------------------
  const { favorited, handleToggleFavorite } = useFavorite({
    currentSource,
    currentId,
    searchTitle,
    currentSourceRef,
    currentIdRef,
    videoTitleRef,
    detailRef,
  });

  // 纠错成功后的回调
  const handleCorrectSuccess = () => {
    if (!detail || detail.source !== 'xiaoya') return;

    // 从 localStorage 读取纠错信息
    const correction = getXiaoyaCorrection(detail.source, detail.id);
    if (correction) {
      logger.info('应用纠错信息:', correction);

      // 只更新显示相关的状态，不更新 detail（避免触发其他 useEffect）
      if (correction.title) {
        setVideoTitle(correction.title);
      }
      if (correction.posterPath) {
        const fullPosterUrl = processImageUrl(
          getTMDBImageUrl(correction.posterPath)
        );
        setVideoCover(fullPosterUrl);
      }
      if (correction.overview) {
        setCorrectedDesc(correction.overview);
      }
      if (correction.doubanId) {
        const doubanIdNum =
          typeof correction.doubanId === 'string'
            ? parseInt(correction.doubanId, 10)
            : correction.doubanId;
        setVideoDoubanId(doubanIdNum);
      }

      // 更新 detailRef，这样其他地方使用 detailRef 时能获取到最新信息
      if (detailRef.current) {
        detailRef.current = applyCorrection(detailRef.current, correction);
      }

      // 更新 availableSources 中的小雅源信息
      setAvailableSources((prevSources) =>
        applyCorrectionsToSources(prevSources)
      );

      logger.info('已应用纠错信息');
    }
  };

  const loadPlayerContext = useLatest({
    activeAdBlockRef,
    anime4k,
    artPlayerRef,
    artRef,
    blockAdEnabled,
    blockAdEnabledRef,
    currentEpisodeIndex,
    currentEpisodeIndexRef,
    currentIdRef,
    currentSource,
    currentSourceRef,
    danmaku,
    danmakuHeatmapDisabledRef,
    danmakuHeatmapEnabledRef,
    detail,
    detailRef,
    episodeSubtitles,
    handleNextEpisode,
    handleSkipConfigChange,
    harmonyHlsPlaybackMode,
    isEpisodeFilteredByTitle,
    isHarmonyOS,
    isLazyDetailSource,
    isPlaybackThumbnailDisabled,
    keyboardRef,
    lastSaveTimeRef,
    lastSkipCheckRef,
    lastVolumeRef,
    linkRefresher,
    loading,
    nativeHlsAdBlockEnabled,
    netdiskHlsPlaybackMode,
    nextEpisodeDanmakuPreloadTriggeredRef,
    nextEpisodePreCacheTriggeredRef,
    playRecordJumpDismissedRef,
    playRecordJumpInitialCheckRef,
    playRecordJumpLayerRef,
    playerEpisodeLabel,
    proxyAttemptedRef,
    quickForwardSecondsRef,
    releasePlayerResources,
    restoreWebFullscreenOnReadyRef,
    resumePlayingAfterHlsModeSwitchRef,
    resumeTimeRef,
    saveCurrentPlayProgress,
    searchParams,
    seekQuickForward,
    seekStepSecondsRef,
    setBlockAdEnabled,
    setCorsFailedUrl,
    setCurrentEpisodeIndex,
    setDanmakuHeatmapEnabled,
    setError,
    setIsVideoLoading,
    setIsWebFullscreen,
    setPlayerReady,
    setQuickForwardSeconds,
    setSeekStepSeconds,
    setShowDanmakuFilterSettings,
    setVideoError,
    skipConfigRef,
    stopKeyboardRef,
    subtitles,
    supportsNativeHls,
    totalEpisodes,
    videoCover,
    videoMediaTypeRef,
    videoQualities,
    videoTitle,
    videoUrl,
    watchPlayerRef,
  });

  useEffect(
    () => makeLoadPlayer(loadPlayerContext.current)(),
    [
      videoUrl,
      loading,
      blockAdEnabled,
      harmonyHlsPlaybackMode,
      nativeHlsAdBlockEnabled,
      netdiskHlsPlaybackMode,
      loadPlayerContext,
    ]
  );

  // 当组件卸载时清理播放器资源
  // cleanupPlayer 只动 ref，用哪一次渲染的都一样；经 useLatest 读，依赖不跟着它变
  const cleanupPlayerLatest = useLatest(cleanupPlayer);
  useEffect(() => {
    const cleanup = cleanupPlayerLatest.current;
    return () => {
      // 销毁播放器实例
      cleanup();
    };
  }, [cleanupPlayerLatest]);

  return {
    favorited,
    handleToggleFavorite,
    handleCorrectSuccess,
    loadPlayerContext,
  };
}

export type PlaybackFavorites = ReturnType<typeof usePlaybackFavorites>;
