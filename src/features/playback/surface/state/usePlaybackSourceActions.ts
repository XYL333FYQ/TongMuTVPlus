'use client';

/*
 * 播放页状态（七）：工具函数、优选、更新播放地址、销毁播放器。
 */

import { useEffect } from 'react';

import { logger } from '@/lib/logger';
import { writeSetting } from '@/lib/settings';
import { useLatest } from '@/hooks/useLatest';

import type { PlaybackEngine } from './usePlaybackEngine';
import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackSession0 } from './usePlaybackSession0';
import type { PlaybackSourceState } from './usePlaybackSourceState';
import type { PlaybackStreams } from './usePlaybackStreams';
import { makeHandleDownloadEpisode } from '../../downloads/download-episode';
import { checkFileSystemDownload } from '../../downloads/file-system-download';
import { makeCheckLocalDownload } from '../../downloads/local-download';
import {
  type HarmonyHlsPlaybackMode,
  type NetdiskHlsPlaybackMode,
  HARMONY_HLS_PLAYBACK_MODE_KEY,
  NETDISK_HLS_PLAYBACK_MODE_KEY,
} from '../../lib/hls-modes';
import { isHlsPlaybackUrl } from '../../lib/playback-urls';
import { makeHandleSkipConfigChange } from '../../player/skip-config';
import { makePreferBestSource } from '../../sources/prefer-best-source';
import { makeCalculateSourceScore } from '../../sources/source-score';
import { makeFetchCurrentSourceVideoInfo } from '../../sources/source-video-info';
import { makeUpdateVideoUrl } from '../../sources/update-video-url';

export function usePlaybackSourceActions(
  vm: PlaybackSession0 &
    PlaybackIdentity &
    PlaybackEpisodeSync &
    PlaybackStreams &
    PlaybackSourceState &
    PlaybackEngine
) {
  const {
    artPlayerRef,
    surfaceActiveRef,
    addDownloadTask,
    enableOfflineDownload,
    hasOfflinePermission,
    detail,
    setSkipConfig,
    skipConfigRef,
    externalPlayerAdBlock,
    setExternalPlayerAdBlock,
    videoTitle,
    currentSource,
    currentId,
    isLazyDetailSource,
    currentEpisodeIndex,
    currentSourceRef,
    currentIdRef,
    detailRef,
    videoUrl,
    setVideoUrl,
    setPlaybackSourceBadge,
    isHarmonyOS,
    harmonyHlsPlaybackMode,
    setHarmonyHlsPlaybackMode,
    setCorsFailedUrl,
    setVideoError,
    setVideoLoadingStage,
    setIsVideoLoading,
    netdiskHlsPlaybackMode,
    setNetdiskHlsPlaybackMode,
    setVideoQualities,
    linkRefresher,
    videoMediaTypeRef,
    sourceProxyMode,
    resumeTimeRef,
    resumePlayingAfterHlsModeSwitchRef,
    preferStrategy,
    preferMode,
    setPrecomputedVideoInfo,
    setCurrentSourceVideoInfo,
    videoUrlRequestSeqRef,
    lastVideoRequestKeyRef,
    isDirectplayDomainProxied,
    setPlayerReady,
    restoreWebFullscreenOnReadyRef,
    watchPlayerRef,
    stopKeyboardRef,
  } = vm;
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 获取当前源的视频信息（分辨率和码率）
  const fetchCurrentSourceVideoInfo = makeFetchCurrentSourceVideoInfo({
    currentEpisodeIndex,
    currentSource,
    detail,
    isDirectplayDomainProxied,
    setCurrentSourceVideoInfo,
    sourceProxyMode,
    videoMediaTypeRef,
  });

  // 播放源优选函数
  const preferBestSource = makePreferBestSource({
    get calculateSourceScore() {
      return calculateSourceScore;
    },
    isDirectplayDomainProxied,
    preferStrategy,
    setPrecomputedVideoInfo,
  });

  // 计算播放源综合评分
  const calculateSourceScore = makeCalculateSourceScore({ preferMode });

  const cleanupLocalPlaybackBlobUrls = () => {
    if (typeof window === 'undefined') return;
    const urls = window.__localFileBlobUrls;
    if (Array.isArray(urls)) {
      urls.forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    }
    window.__localFileBlobUrls = [];
  };

  // 检查是否有本地下载的视频
  const checkLocalDownload = makeCheckLocalDownload({
    enableOfflineDownload,
    hasOfflinePermission,
  });

  /**
   * 检查 File System API 本地下载
   */

  // 更新视频地址
  const updateVideoUrl = makeUpdateVideoUrl({
    artPlayerRef,
    checkFileSystemDownload,
    checkLocalDownload,
    cleanupLocalPlaybackBlobUrls,
    currentId,
    currentSource,
    detailRef,
    isDirectplayDomainProxied,
    isLazyDetailSource,
    lastVideoRequestKeyRef,
    linkRefresher,
    setCorsFailedUrl,
    setIsVideoLoading,
    setPlaybackSourceBadge,
    setVideoError,
    setVideoLoadingStage,
    setVideoQualities,
    setVideoUrl,
    sourceProxyMode,
    videoMediaTypeRef,
    videoUrl,
    videoUrlRequestSeqRef,
  });

  // 处理下载指定集数（支持批量下载）
  const handleDownloadEpisode = makeHandleDownloadEpisode({
    addDownloadTask,
    artPlayerRef,
    currentId,
    currentSource,
    detail,
    externalPlayerAdBlock,
    videoTitle,
  });

  const prepareHarmonyHlsReinit = () => {
    const player = artPlayerRef.current;
    if (player) {
      const currentTime = Number(player.currentTime) || 0;
      resumeTimeRef.current = currentTime > 0 ? currentTime : null;
      resumePlayingAfterHlsModeSwitchRef.current = !player.paused;
    }

    setVideoError(null);
    setCorsFailedUrl(null);
    setVideoLoadingStage('sourceChanging');
    setIsVideoLoading(true);
    setPlayerReady(false);
  };

  const switchHarmonyHlsPlaybackMode = (mode: HarmonyHlsPlaybackMode) => {
    if (mode === harmonyHlsPlaybackMode) return;

    prepareHarmonyHlsReinit();

    writeSetting(HARMONY_HLS_PLAYBACK_MODE_KEY, mode);
    setHarmonyHlsPlaybackMode(mode);
  };

  const switchNetdiskHlsPlaybackMode = (mode: NetdiskHlsPlaybackMode) => {
    if (mode === netdiskHlsPlaybackMode) return;

    prepareHarmonyHlsReinit();

    writeSetting(NETDISK_HLS_PLAYBACK_MODE_KEY, mode);
    setNetdiskHlsPlaybackMode(mode);
  };

  const toggleToolbarAdBlock = () => {
    if (
      isHarmonyOS &&
      harmonyHlsPlaybackMode === 'native' &&
      isHlsPlaybackUrl(videoUrl)
    ) {
      prepareHarmonyHlsReinit();
    }
    setExternalPlayerAdBlock(!externalPlayerAdBlock);
  };

  // 播放器实例销毁前（内核换实例、页面卸载时调用）：记住网页全屏（弹幕、超分、字幕、续期各自管）
  const releasePlayerResources = () => {
    if (surfaceActiveRef.current) setPlayerReady(false);

    if (artPlayerRef.current) {
      try {
        // 网页全屏时 Artplayer 会把 $player 挂到 document.body，内核销毁前会先退出；
        // 这里记住状态，新实例 ready 后恢复
        restoreWebFullscreenOnReadyRef.current =
          !!artPlayerRef.current.fullscreenWeb;
        artPlayerRef.current = null;
      } catch (err) {
        logger.warn('清理播放器资源时出错:', err);
        artPlayerRef.current = null;
      }
    }
  };

  // 销毁播放器（页面卸载、离开前）
  const cleanupPlayer = () => {
    stopKeyboardRef.current?.();
    stopKeyboardRef.current = null;
    watchPlayerRef.current?.destroy();
    watchPlayerRef.current = null;
    artPlayerRef.current = null;
  };

  // 跳过片头片尾配置相关函数
  const handleSkipConfigChange = makeHandleSkipConfigChange({
    artPlayerRef,
    currentIdRef,
    currentSourceRef,
    get handleSkipConfigChange() {
      return handleSkipConfigChange;
    },
    setSkipConfig,
    skipConfigRef,
  });

  // 当集数索引变化时自动更新视频地址
  const updateVideoUrlLatest = useLatest(updateVideoUrl);
  useEffect(() => {
    updateVideoUrlLatest.current(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex, updateVideoUrlLatest]);

  return {
    fetchCurrentSourceVideoInfo,
    preferBestSource,
    calculateSourceScore,
    cleanupLocalPlaybackBlobUrls,
    checkLocalDownload,
    updateVideoUrl,
    handleDownloadEpisode,
    prepareHarmonyHlsReinit,
    switchHarmonyHlsPlaybackMode,
    switchNetdiskHlsPlaybackMode,
    toggleToolbarAdBlock,
    releasePlayerResources,
    cleanupPlayer,
    handleSkipConfigChange,
    updateVideoUrlLatest,
  };
}

export type PlaybackSourceActions = ReturnType<typeof usePlaybackSourceActions>;
