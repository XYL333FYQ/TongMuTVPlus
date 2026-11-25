'use client';

/*
 * 播放页状态（四）：网盘 / 鸿蒙原生 HLS、清晰度、链接续期、源代理、本机转码、播放器跳转进度。
 */

import { useRef, useState } from 'react';

import { isNetdiskSource } from '@/lib/netdisk/source';
import { readSetting } from '@/lib/settings';
import { formatDuration } from '@/lib/time';

import { LinkRefresher } from '@/features/player';

import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackSession0 } from './usePlaybackSession0';
import {
  type NetdiskHlsPlaybackMode,
  NETDISK_HLS_PLAYBACK_MODE_KEY,
} from '../../lib/hls-modes';
import { makeHandleCreateTranscodeSession } from '../../player/transcode';

export function usePlaybackStreams(
  vm: PlaybackSession0 & PlaybackIdentity & PlaybackEpisodeSync
) {
  const {
    artPlayerRef,
    linkRefresherRef,
    LOCAL_TRANSCODER_BASE_URL,
    detail,
    quickForwardSecondsRef,
    isTranscoding,
    setIsTranscoding,
    isDirectPlay,
    isM3u8LikeUrl,
    buildAbsoluteUrl,
    currentEpisodeIndex,
    totalEpisodes,
    videoUrl,
    setVideoUrl,
    setPlaybackSourceBadge,
  } = vm;
  // 标记当前视频是否已经尝试过代理（防止 415→直连→失败→代理 的无限循环）
  const proxyAttemptedRef = useRef(false);
  // 直链播放时 CORS 失败的原始 URL，用于显示"使用代理播放"按钮
  const [corsFailedUrl, setCorsFailedUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging' | 'episodeChanging'
  >('initing');
  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  // 网盘挂载（openlist / xiaoya / netdisk-*）原生 HLS：Edge/Safari 可原生播放 m3u8，
  // 直连网盘 CDN，无需代理与去广告，播放更快。仅对支持原生 HLS 的浏览器启用。
  const [supportsNativeHls] = useState(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }
    try {
      const video = document.createElement('video');
      const result = video.canPlayType?.('application/vnd.apple.mpegurl');
      return result === 'probably' || result === 'maybe';
    } catch {
      return false;
    }
  });
  const [netdiskHlsPlaybackMode, setNetdiskHlsPlaybackMode] =
    useState<NetdiskHlsPlaybackMode>(() => {
      if (!supportsNativeHls) return 'hlsjs';
      return readSetting(NETDISK_HLS_PLAYBACK_MODE_KEY) === 'hlsjs'
        ? 'hlsjs'
        : 'native';
    });

  // 视频清晰度列表
  const [videoQualities, setVideoQualities] = useState<
    Array<{ name: string; url: string }>
  >([]);

  // 小雅 / OpenList 链接续期：每 14 分钟静默换新链接，清单 403 时也立即换（内核 LinkRefresher）
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false); // 是否正在刷新链接
  const linkRefresher = (linkRefresherRef.current ??= new LinkRefresher({
    video: () => artPlayerRef.current?.video ?? null,
    notice: (text) => {
      if (artPlayerRef.current) artPlayerRef.current.notice.show = text;
    },
    fail: (message) => setVideoError(message),
    qualities: (list) => setVideoQualities(list),
    busy: (on) => setIsRefreshingUrl(on),
  }));
  const videoMediaTypeRef = useRef<'hls' | 'file' | ''>('');

  // 视频源代理模式状态
  const [sourceProxyMode, setSourceProxyMode] = useState(false);

  const resolveCurrentExternalPlaybackUrl = async () => {
    let urlToUse = videoUrl;
    if (
      sourceProxyMode &&
      detail?.episodes &&
      currentEpisodeIndex < detail.episodes.length
    ) {
      urlToUse = detail.episodes[currentEpisodeIndex];
    }

    if (!urlToUse) {
      return null;
    }

    return buildAbsoluteUrl(urlToUse);
  };

  const handleCreateTranscodeSession = makeHandleCreateTranscodeSession({
    LOCAL_TRANSCODER_BASE_URL,
    get artPlayerRef() {
      return artPlayerRef;
    },
    isTranscoding,
    linkRefresher,
    get proxyAttemptedRef() {
      return proxyAttemptedRef;
    },
    resolveCurrentExternalPlaybackUrl,
    get resumeTimeRef() {
      return resumeTimeRef;
    },
    get setCorsFailedUrl() {
      return setCorsFailedUrl;
    },
    setIsTranscoding,
    get setIsVideoLoading() {
      return setIsVideoLoading;
    },
    setPlaybackSourceBadge,
    get setVideoError() {
      return setVideoError;
    },
    get setVideoLoadingStage() {
      return setVideoLoadingStage;
    },
    setVideoQualities,
    setVideoUrl,
  });

  const showExternalTranscodeButton = Boolean(
    detail &&
      videoUrl &&
      !videoUrl.startsWith('blob:') &&
      !isM3u8LikeUrl(videoUrl) &&
      (detail.source === 'openlist' ||
        isNetdiskSource(detail.source) ||
        detail.source === 'xiaoya' ||
        detail.source.startsWith('emby'))
  );

  const directEpisodeLabel =
    detail?.episodes_titles?.[currentEpisodeIndex] || '直链';
  const shouldShowEpisodeLabel = totalEpisodes > 1 || isDirectPlay;
  const episodeLabel = isDirectPlay
    ? directEpisodeLabel
    : detail?.episodes_titles?.[currentEpisodeIndex] ||
      `第 ${currentEpisodeIndex + 1} 集`;
  const playerEpisodeLabel = isDirectPlay
    ? directEpisodeLabel
    : `第${currentEpisodeIndex + 1}集`;

  const seekQuickForward = () => {
    const player = artPlayerRef.current;
    if (!player) return false;

    const duration = Number.isFinite(player.duration)
      ? player.duration
      : Infinity;
    const nextTime = Math.min(
      duration,
      (player.currentTime || 0) + quickForwardSecondsRef.current
    );
    player.currentTime = nextTime;
    player.notice.show = `快进 ${formatDuration(
      quickForwardSecondsRef.current
    )}`;
    return true;
  };

  const isPlaybackThumbnailDisabled = () => {
    if (typeof window === 'undefined') {
      return true;
    }

    const saved = readSetting('disablePlaybackThumbnail');
    if (saved !== null) {
      return saved === 'true';
    }

    return true;
  };

  // 用于记录是否需要在播放器 ready 后跳转到指定进度
  const resumeTimeRef = useRef<number | null>(null);
  // 切换鸿蒙 HLS 内核时，同时恢复切换前的播放/暂停状态。
  const resumePlayingAfterHlsModeSwitchRef = useRef<boolean | null>(null);
  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(0.7);

  return {
    proxyAttemptedRef,
    corsFailedUrl,
    setCorsFailedUrl,
    videoError,
    setVideoError,
    videoLoadingStage,
    setVideoLoadingStage,
    isVideoLoading,
    setIsVideoLoading,
    supportsNativeHls,
    netdiskHlsPlaybackMode,
    setNetdiskHlsPlaybackMode,
    videoQualities,
    setVideoQualities,
    isRefreshingUrl,
    setIsRefreshingUrl,
    linkRefresher,
    videoMediaTypeRef,
    sourceProxyMode,
    setSourceProxyMode,
    resolveCurrentExternalPlaybackUrl,
    handleCreateTranscodeSession,
    showExternalTranscodeButton,
    directEpisodeLabel,
    shouldShowEpisodeLabel,
    episodeLabel,
    playerEpisodeLabel,
    seekQuickForward,
    isPlaybackThumbnailDisabled,
    resumeTimeRef,
    resumePlayingAfterHlsModeSwitchRef,
    lastVolumeRef,
  };
}

export type PlaybackStreams = ReturnType<typeof usePlaybackStreams>;
