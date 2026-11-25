'use client';

/*
 * 播放页状态（三）：换集 / 换片时的同步和弹幕、豆瓣评分、TMDB 背景、分集名、播放地址和来源角标。
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import { readSetting } from '@/lib/settings';
import { SearchResult } from '@/lib/types';
import { useLatest } from '@/hooks/useLatest';

import { type HlsInstance } from '@/features/player';

import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackSession0 } from './usePlaybackSession0';
import { useEpisodeNames } from '../useEpisodeNames';
import { useNetdiskTmdbMerge } from '../useNetdiskTmdbMerge';
import { makeLoadDoubanRating } from '../../data/load-douban-rating';
import { makeLoadTmdbBackdrop } from '../../data/load-tmdb-backdrop';
import {
  type HarmonyHlsPlaybackMode,
  HARMONY_HLS_PLAYBACK_MODE_KEY,
} from '../../lib/hls-modes';
import type { PlaybackSourceBadge } from '../../page/types';

export function usePlaybackEpisodeSync(
  vm: PlaybackSession0 & PlaybackIdentity
) {
  const {
    artPlayerRef,
    searchParams,
    loading,
    detail,
    setDetail,
    setTmdbBackdrop,
    tmdbEpisodeNames,
    setTmdbEpisodeNames,
    resolvedTmdbIdStr,
    setResolvedTmdbIdStr,
    tmdbEpisodesFetchedIdRef,
    titleCorrection,
    externalPlayerAdBlock,
    danmaku,
    danmakuState,
    videoTitle,
    videoYear,
    setVideoYear,
    setVideoCover,
    videoDoubanId,
    setDoubanRating,
    setDoubanCardSubtitle,
    setDoubanAka,
    setDoubanYear,
    correctedDesc,
    setCorrectedDesc,
    setNetdiskTMDBMeta,
    pendingNetdiskTMDBData,
    setPendingNetdiskTMDBData,
    currentSource,
    currentId,
    isDirectPlay,
    episodeTitleFetchDisabled,
    currentEpisodeIndex,
  } = vm;
  const nextEpisodeDanmakuPreloadTriggeredRef = useRef<boolean>(false);
  const nextEpisodePreCacheHlsRef = useRef<HlsInstance | null>(null);
  // 下集预缓存相关
  const nextEpisodePreCacheTriggeredRef = useRef<boolean>(false);
  const playRecordJumpInitialCheckRef = useRef(true); // 记录是否是首次检查播放记录
  const playRecordJumpLayerRef = useRef<HTMLElement | null>(null); // 保存跳转按钮层的引用
  // 播放记录跳转按钮状态
  const playRecordJumpDismissedRef = useRef(false); // 记录用户是否已经关闭过跳转按钮
  const suppressPlayRecordJumpOnNextEpisodeChangeRef = useRef(false); // 主动切集时不显示播放记录跳转提示
  // 监听集数变化，移除已显示的跳转按钮
  useEffect(() => {
    // 移除已显示的跳转按钮
    if (playRecordJumpLayerRef.current && artPlayerRef.current) {
      try {
        artPlayerRef.current.layers.remove('play-record-jump');
        playRecordJumpLayerRef.current = null;
      } catch (err) {
        logger.warn('[PlayRecordJump] 移除跳转按钮失败:', err);
      }
    }

    // 用户主动切集/自动下一集时不再弹“上次播放到 xx”。
    // 首次进入页面仍保留检查能力，用于展示继续播放提示。
    if (suppressPlayRecordJumpOnNextEpisodeChangeRef.current) {
      playRecordJumpInitialCheckRef.current = false;
      playRecordJumpDismissedRef.current = true;
      suppressPlayRecordJumpOnNextEpisodeChangeRef.current = false;
      return;
    }

    playRecordJumpInitialCheckRef.current = true;
    playRecordJumpDismissedRef.current = false;
  }, [currentEpisodeIndex, artPlayerRef]);

  // The session replaces only the playback surface when the selected film changes.
  // A whole-page reload would discard the room connection and chat state.
  useEffect(() => {
    isSourceChangingRef.current = false;
  }, [searchParams, videoTitle]);

  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);
  const isSourceChangingRef = useRef(false); // 标记是否正在换源

  // 同步最新值到 refs
  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
  ]);

  // 当集数改变时，重置下集预缓存标记
  useEffect(() => {
    nextEpisodePreCacheTriggeredRef.current = false;
    nextEpisodeDanmakuPreloadTriggeredRef.current = false;
    // 清理之前的预缓存 HLS 实例
    if (nextEpisodePreCacheHlsRef.current) {
      try {
        nextEpisodePreCacheHlsRef.current.destroy();
      } catch (e) {
        logger.error('清理预缓存 HLS 实例失败:', e);
      }
      nextEpisodePreCacheHlsRef.current = null;
    }
  }, [currentEpisodeIndex]);

  // 换片 / 换集：告诉弹幕控制器（它自己按缓存 → 手动选择 → 记住的番剧 → 搜索的顺序加载）
  useEffect(() => {
    if (loading) return;
    if (isDirectPlay) {
      danmaku.setMedia(null);
      return;
    }
    if (currentEpisodeIndex < 0 || !videoTitle) return;
    danmaku.setMedia({
      title: videoTitle,
      year: detailRef.current?.year,
      episodeIndex: currentEpisodeIndex,
      episodeTitles: detailRef.current?.episodes_titles,
      episodeCount: detailRef.current?.episodes?.length || 0,
    });
  }, [currentEpisodeIndex, videoTitle, loading, isDirectPlay, danmaku]);

  // 获取豆瓣评分数据
  const loadDoubanRatingContext = useLatest({
    isDirectPlay,
    setDoubanAka,
    setDoubanCardSubtitle,
    setDoubanRating,
    setDoubanYear,
    videoDoubanId,
  });
  useEffect(
    () => makeLoadDoubanRating(loadDoubanRatingContext.current)(),
    [videoDoubanId, isDirectPlay, loadDoubanRatingContext]
  );

  // 获取TMDB背景图
  const loadTmdbBackdropContext = useLatest({
    correctedDesc,
    detailRef,
    isDirectPlay,
    setCorrectedDesc,
    setDetail,
    setDoubanCardSubtitle,
    setDoubanRating,
    setDoubanYear,
    setNetdiskTMDBMeta,
    setPendingNetdiskTMDBData,
    setResolvedTmdbIdStr,
    setTmdbBackdrop,
    setTmdbEpisodeNames,
    setVideoCover,
    setVideoYear,
    videoDoubanId,
    videoTitle,
  });
  useEffect(
    () => makeLoadTmdbBackdrop(loadTmdbBackdropContext.current)(),
    [videoTitle, videoDoubanId, isDirectPlay, loadTmdbBackdropContext]
  );

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 选集面板里每一集的名字（弹幕库 / TMDB）
  const richEpisodeNames = useEpisodeNames({
    detail,
    videoTitle,
    isDirectPlay,
    totalEpisodes,
    titleCorrection,
    episodeTitleFetchDisabled,
    danmakuState,
    resolvedTmdbIdStr,
    tmdbEpisodeNames,
    setTmdbEpisodeNames,
    tmdbEpisodesFetchedIdRef,
  });

  useNetdiskTmdbMerge({
    detail,
    pendingNetdiskTMDBData,
    setPendingNetdiskTMDBData,
    setNetdiskTMDBMeta,
    setDetail,
    setVideoCover,
    setVideoYear,
    setCorrectedDesc,
  });

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');
  const [playbackSourceBadge, setPlaybackSourceBadge] =
    useState<PlaybackSourceBadge>(null);

  // 鸿蒙浏览器使用原生 HLS 时，video.currentSrc 会保留真实 m3u8，便于浏览器投屏。
  const [isHarmonyOS] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      /OpenHarmony/i.test(navigator.userAgent)
  );
  const [harmonyHlsPlaybackMode, setHarmonyHlsPlaybackMode] =
    useState<HarmonyHlsPlaybackMode>(() => {
      if (
        typeof navigator === 'undefined' ||
        !/OpenHarmony/i.test(navigator.userAgent)
      ) {
        return 'hlsjs';
      }

      const savedMode = readSetting(HARMONY_HLS_PLAYBACK_MODE_KEY);
      return savedMode === 'native' ? 'native' : 'hlsjs';
    });
  const nativeHlsAdBlockEnabled =
    isHarmonyOS && harmonyHlsPlaybackMode === 'native' && externalPlayerAdBlock;

  return {
    nextEpisodeDanmakuPreloadTriggeredRef,
    nextEpisodePreCacheHlsRef,
    nextEpisodePreCacheTriggeredRef,
    playRecordJumpInitialCheckRef,
    playRecordJumpLayerRef,
    playRecordJumpDismissedRef,
    suppressPlayRecordJumpOnNextEpisodeChangeRef,
    currentSourceRef,
    currentIdRef,
    videoTitleRef,
    videoYearRef,
    detailRef,
    currentEpisodeIndexRef,
    isSourceChangingRef,
    loadDoubanRatingContext,
    loadTmdbBackdropContext,
    totalEpisodes,
    richEpisodeNames,
    videoUrl,
    setVideoUrl,
    playbackSourceBadge,
    setPlaybackSourceBadge,
    isHarmonyOS,
    harmonyHlsPlaybackMode,
    setHarmonyHlsPlaybackMode,
    nativeHlsAdBlockEnabled,
  };
}

export type PlaybackEpisodeSync = ReturnType<typeof usePlaybackEpisodeSync>;
