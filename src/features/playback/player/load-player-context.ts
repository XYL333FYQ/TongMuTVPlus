/*
 * 自己看：makeLoadPlayer 要页面传进来的状态和函数（名字和页面里的一样）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { SearchResult } from '@/lib/types';

import type {
  Anime4KController,
  Art,
  DanmakuController,
  LinkRefresher,
  SourceSubtitle,
  SubtitleController,
  WatchPlayer,
} from '@/features/player';

import type {
  HarmonyHlsPlaybackMode,
  NetdiskHlsPlaybackMode,
} from '../lib/hls-modes';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface LoadPlayerContext {
  activeAdBlockRef: MutableRefObject<boolean | null>;
  anime4k: Anime4KController;
  artPlayerRef: MutableRefObject<Art | null>;
  artRef: MutableRefObject<HTMLDivElement | null>;
  blockAdEnabled: boolean;
  blockAdEnabledRef: MutableRefObject<boolean>;
  currentEpisodeIndex: number;
  currentEpisodeIndexRef: MutableRefObject<number>;
  currentIdRef: MutableRefObject<string>;
  currentSource: string;
  currentSourceRef: MutableRefObject<string>;
  danmaku: DanmakuController;
  danmakuHeatmapDisabledRef: MutableRefObject<boolean>;
  danmakuHeatmapEnabledRef: MutableRefObject<boolean>;
  detail: SearchResult | null;
  detailRef: MutableRefObject<SearchResult | null>;
  episodeSubtitles: () => SourceSubtitle[];
  handleNextEpisode: () => Promise<void>;
  handleSkipConfigChange: (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => Promise<void>;
  harmonyHlsPlaybackMode: HarmonyHlsPlaybackMode;
  isEpisodeFilteredByTitle: (title: string) => boolean;
  isHarmonyOS: boolean;
  isLazyDetailSource: (source?: string) => boolean;
  isPlaybackThumbnailDisabled: () => boolean;
  keyboardRef: MutableRefObject<{
    active: () => boolean;
    previous: () => boolean;
    next: () => boolean;
  }>;
  lastSaveTimeRef: MutableRefObject<number>;
  lastSkipCheckRef: MutableRefObject<number>;
  lastVolumeRef: MutableRefObject<number>;
  linkRefresher: LinkRefresher;
  loading: boolean;
  nativeHlsAdBlockEnabled: boolean;
  netdiskHlsPlaybackMode: NetdiskHlsPlaybackMode;
  nextEpisodeDanmakuPreloadTriggeredRef: MutableRefObject<boolean>;
  nextEpisodePreCacheTriggeredRef: MutableRefObject<boolean>;
  playRecordJumpDismissedRef: MutableRefObject<boolean>;
  playRecordJumpInitialCheckRef: MutableRefObject<boolean>;
  playRecordJumpLayerRef: MutableRefObject<HTMLElement | null>;
  playerEpisodeLabel: string;
  proxyAttemptedRef: MutableRefObject<boolean>;
  quickForwardSecondsRef: MutableRefObject<number>;
  releasePlayerResources: () => void;
  restoreWebFullscreenOnReadyRef: MutableRefObject<boolean>;
  resumePlayingAfterHlsModeSwitchRef: MutableRefObject<boolean | null>;
  resumeTimeRef: MutableRefObject<number | null>;
  saveCurrentPlayProgress: () => Promise<void>;
  searchParams: URLSearchParams;
  seekQuickForward: () => boolean;
  seekStepSecondsRef: MutableRefObject<number>;
  setBlockAdEnabled: Dispatch<SetStateAction<boolean>>;
  setCorsFailedUrl: Dispatch<SetStateAction<string | null>>;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  setDanmakuHeatmapEnabled: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setIsWebFullscreen: Dispatch<SetStateAction<boolean>>;
  setPlayerReady: Dispatch<SetStateAction<boolean>>;
  setQuickForwardSeconds: Dispatch<SetStateAction<number>>;
  setSeekStepSeconds: Dispatch<SetStateAction<number>>;
  setShowDanmakuFilterSettings: Dispatch<SetStateAction<boolean>>;
  setVideoError: Dispatch<SetStateAction<string | null>>;
  skipConfigRef: MutableRefObject<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>;
  stopKeyboardRef: MutableRefObject<(() => void) | null>;
  subtitles: SubtitleController;
  supportsNativeHls: boolean;
  totalEpisodes: number;
  videoCover: string;
  videoMediaTypeRef: MutableRefObject<'' | 'hls' | 'file'>;
  videoQualities: { name: string; url: string }[];
  videoTitle: string;
  videoUrl: string;
  watchPlayerRef: MutableRefObject<WatchPlayer | null>;
}
