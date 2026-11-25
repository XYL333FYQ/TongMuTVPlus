'use client';

/*
 * 播放页状态（八）：进入页面时取详情和全部源。
 */

import { useEffect } from 'react';

import { getSkipConfig } from '@/lib/db.client';
import { logger } from '@/lib/logger';
import { normalizeNetdiskSource } from '@/lib/netdisk/source';
import { useLatest } from '@/hooks/useLatest';

import type { PlaybackEngine } from './usePlaybackEngine';
import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackSession0 } from './usePlaybackSession0';
import type { PlaybackSourceActions } from './usePlaybackSourceActions';
import type { PlaybackSourceState } from './usePlaybackSourceState';
import type { PlaybackStreams } from './usePlaybackStreams';
import { makeLoadSourceDetail } from '../../data/load-source-detail';

export function usePlaybackLoad(
  vm: PlaybackSession0 &
    PlaybackIdentity &
    PlaybackEpisodeSync &
    PlaybackStreams &
    PlaybackSourceState &
    PlaybackEngine &
    PlaybackSourceActions
) {
  const {
    artPlayerRef,
    searchParams,
    playbackSession,
    reloadPlayback,
    commitPlaybackHref,
    setLoading,
    setLoadingStage,
    setLoadingMessage,
    setError,
    setDetail,
    setSkipConfig,
    videoTitle,
    setVideoTitle,
    setVideoYear,
    setVideoCover,
    setVideoDoubanId,
    setCorrectedDesc,
    currentSource,
    setCurrentSource,
    currentId,
    setCurrentId,
    fileName,
    isLazyDetailSource,
    searchTitle,
    searchType,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    setNeedPrefer,
    needPreferRef,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
    videoTitleRef,
    videoYearRef,
    currentEpisodeIndexRef,
    setSourceProxyMode,
    resumeTimeRef,
    availableSources,
    setAvailableSources,
    setSourceSearchLoading,
    setSourceSearchError,
    setFallbackRecommendations,
    setHasCompletedSearchRequest,
    setBackgroundSourcesLoading,
    optimizationEnabled,
    preferBestSource,
  } = vm;
  // 进入页面时直接获取全部源信息
  const loadSourceDetailContext = useLatest({
    commitPlaybackHref,
    currentEpisodeIndex,
    currentEpisodeIndexRef,
    currentId,
    currentSource,
    fileName,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    isLazyDetailSource,
    needPreferRef,
    optimizationEnabled,
    playbackSession,
    preferBestSource,
    resumeTimeRef,
    searchParams,
    searchTitle,
    searchType,
    setAvailableSources,
    setBackgroundSourcesLoading,
    setCorrectedDesc,
    setCurrentEpisodeIndex,
    setCurrentId,
    setCurrentSource,
    setDetail,
    setError,
    setFallbackRecommendations,
    setHasCompletedSearchRequest,
    setLoading,
    setLoadingMessage,
    setLoadingStage,
    setNeedPrefer,
    setSourceProxyMode,
    setSourceSearchError,
    setSourceSearchLoading,
    setVideoCover,
    setVideoDoubanId,
    setVideoTitle,
    setVideoYear,
    videoTitle,
    videoTitleRef,
    videoYearRef,
  });
  useEffect(
    () => makeLoadSourceDetail(loadSourceDetailContext.current)(),
    [loadSourceDetailContext]
  );

  // 跳过片头片尾配置处理
  const currentIdLatest = useLatest(currentId);
  const currentSourceLatest = useLatest(currentSource);
  const setSkipConfigLatest = useLatest(setSkipConfig);
  useEffect(() => {
    // 仅在初次挂载时检查跳过片头片尾配置
    const initSkipConfig = async () => {
      if (!currentSourceLatest.current || !currentIdLatest.current) return;

      try {
        const config = await getSkipConfig(
          currentSourceLatest.current,
          currentIdLatest.current
        );
        if (config) {
          setSkipConfigLatest.current(config);
        }
      } catch (err) {
        logger.error('读取跳过片头片尾配置失败:', err);
      }
    };

    initSkipConfig();
  }, [currentIdLatest, currentSourceLatest, setSkipConfigLatest]);

  // 监听 URL 参数变化，处理换源和换视频（用于房员跟随房主操作）
  const reloadPlaybackLatest = useLatest(reloadPlayback);
  const setCurrentEpisodeIndexLatest = useLatest(setCurrentEpisodeIndex);
  useEffect(() => {
    const urlSource = normalizeNetdiskSource(searchParams.get('source'));
    const urlId = searchParams.get('id');

    // 只在URL参数存在且与当前状态不同时才处理
    if (
      urlSource &&
      urlId &&
      (urlSource !== currentSource || urlId !== currentId)
    ) {
      // 检查新的source和id是否在可用源列表中
      // 如果 availableSources 还是空的，说明数据还在加载中，不做处理
      if (availableSources.length === 0) {
        return;
      }

      const targetSource = availableSources.find(
        (source) => source.source === urlSource && source.id === urlId
      );

      if (targetSource) {
        // 记录当前播放进度
        const currentPlayTime = artPlayerRef.current?.currentTime || 0;

        // 获取URL中的episode参数
        const episodeParam = searchParams.get('episode');
        const targetEpisode = episodeParam ? parseInt(episodeParam, 10) - 1 : 0;

        // 更新视频源信息（urlSource 已经是完整格式）
        setCurrentSource(urlSource);
        setCurrentId(urlId);
        setVideoTitle(targetSource.title);
        setVideoYear(targetSource.year);
        setVideoCover(targetSource.poster);
        setVideoDoubanId(targetSource.douban_id || 0);
        setDetail(targetSource);
        setSourceProxyMode(targetSource.proxyMode || false); // 从 detail 数据中读取代理模式

        // 更新集数
        if (
          targetEpisode >= 0 &&
          targetEpisode < targetSource.episodes.length
        ) {
          setCurrentEpisodeIndexLatest.current(targetEpisode);

          // 如果是同一集,保存播放进度以便恢复
          if (targetEpisode === currentEpisodeIndex && currentPlayTime > 1) {
            resumeTimeRef.current = currentPlayTime;
          } else {
            resumeTimeRef.current = null;
          }
        }
      } else {
        // Recreate the media surface while preserving the room and global navigation.
        reloadPlaybackLatest.current();
      }
    }
  }, [
    artPlayerRef,
    resumeTimeRef,
    setCurrentId,
    setCurrentSource,
    setDetail,
    setSourceProxyMode,
    setVideoCover,
    setVideoDoubanId,
    setVideoTitle,
    setVideoYear,
    searchParams,
    currentSource,
    currentId,
    availableSources,
    currentEpisodeIndex,
    reloadPlaybackLatest,
    setCurrentEpisodeIndexLatest,
  ]);

  return {
    loadSourceDetailContext,
    currentIdLatest,
    currentSourceLatest,
    setSkipConfigLatest,
    reloadPlaybackLatest,
    setCurrentEpisodeIndexLatest,
  };
}

export type PlaybackLoad = ReturnType<typeof usePlaybackLoad>;
