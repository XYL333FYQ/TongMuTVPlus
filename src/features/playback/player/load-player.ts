/*
 * 自己看：每次换地址 / 换播放方式时，给内核 WatchPlayer 这一集的设置、插件，然后加载（useEffect 的回调）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { SearchResult } from '@/lib/types';

import type { Art } from '@/features/player';
import {
  type SourceSubtitle,
  Anime4KController,
  bindKeyboard,
  checkWebGPU,
  DanmakuController,
  heatmapPlugin,
  iosOrientationPlugin,
  LinkRefresher,
  playbackRatePlugin,
  playerEnvironment,
  progressThumbPlugin,
  SubtitleController,
  wakeLockPlugin,
  WatchPlayer,
} from '@/features/player';

import { buildControls } from './controls';
import { buildSettings } from './settings';
import { makeWireInstance } from './wire-instance';
import {
  type HarmonyHlsPlaybackMode,
  type NetdiskHlsPlaybackMode,
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
  formatQuickForwardDuration: (seconds: number) => string;
  formatTime: (seconds: number) => string;
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

export function makeLoadPlayer(ctx: LoadPlayerContext) {
  const {
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
    formatQuickForwardDuration,
    formatTime,
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
  } = ctx;
  return () => {
    if (
      !videoUrl ||
      loading ||
      currentEpisodeIndex === null ||
      !artRef.current
    ) {
      return;
    }

    // 这类源会先异步补全详情，如果 episodes 为空则跳过
    if (
      isLazyDetailSource(currentSource || detail?.source) &&
      (!detail || !detail.episodes || detail.episodes.length === 0)
    ) {
      return;
    }

    // 确保选集索引有效
    if (
      !detail ||
      !detail.episodes ||
      currentEpisodeIndex >= detail.episodes.length ||
      currentEpisodeIndex < 0
    ) {
      setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
      return;
    }

    if (!videoUrl) {
      setError('视频地址无效');
      return;
    }
    console.log(videoUrl);

    const { ios: isIOS } = playerEnvironment();

    // 片源加载、HLS、换地址还是整体重建、跨域回退都由 WatchPlayer 决定；
    // 这里给它这一集要用的设置菜单、控制条按钮和每个新实例上的事件
    const initPlayer = async () => {
      try {
        // 超分的设置项要看有没有 WebGPU：等检测完再建菜单（检测只做一次）
        const [DanmukuPlugin, AutoThumbnailPlugin, webGPUSupported] =
          await Promise.all([
            import('artplayer-plugin-danmuku'),
            import('@/lib/artplayer-plugin-auto-thumbnail'),
            checkWebGPU(),
          ]);
        const artplayerPluginDanmuku = DanmukuPlugin.default;
        const artplayerPluginAutoThumbnail = AutoThumbnailPlugin.default;
        const playerTimeouts = new Set<number>();
        const schedulePlayerTimeout = (callback: () => void, delay: number) => {
          const timeoutId = window.setTimeout(() => {
            playerTimeouts.delete(timeoutId);
            callback();
          }, delay);
          playerTimeouts.add(timeoutId);
          return timeoutId;
        };
        const clearPlayerTimeouts = () => {
          playerTimeouts.forEach((timeoutId) => {
            window.clearTimeout(timeoutId);
          });
          playerTimeouts.clear();
        };

        if (!watchPlayerRef.current) {
          watchPlayerRef.current = new WatchPlayer({
            container: artRef.current!,
          });
          stopKeyboardRef.current = bindKeyboard({
            player: watchPlayerRef.current,
            active: () => keyboardRef.current.active(),
            seekStep: () => seekStepSecondsRef.current,
            quickForward: () => quickForwardSecondsRef.current,
            previous: () => keyboardRef.current.previous(),
            next: () => keyboardRef.current.next(),
          });
        }
        const player = watchPlayerRef.current;
        player.setOptions({
          adBlock: blockAdEnabledRef.current,
          // 自己看每次从 0.7 开始，换集后由 lastVolumeRef 恢复本次的音量
          initialVolume: 0.7,
          // 第一条字幕是普通字幕时交给 Artplayer 原生加载
          subtitle: subtitles.initialNative(episodeSubtitles()),
          onError: (message, info) => {
            if (message === '视频播放失败' && proxyAttemptedRef.current) {
              // 走过代理后直连也失败：格式问题，不再提供代理按钮
              setVideoError('视频无法在浏览器中播放（已尝试代理，格式不兼容）');
              return;
            }
            if (info?.corsFailedUrl) setCorsFailedUrl(info.corsFailedUrl);
            setVideoError(message);
          },
          // 小雅 / OpenList 清单 403：链接过期了，先换新链接再报错
          onForbidden: () => linkRefresher.onForbidden(),
          onInstance: (art) => wireInstance(art),
          plugins: [
            wakeLockPlugin,
            playbackRatePlugin(),
            progressThumbPlugin,
            iosOrientationPlugin,
            // 弹幕热力图：曲线来自当前弹幕插件里的弹幕（换集清空 / 载入后会发 danmaku:loaded）
            ({ art }) => danmaku.attach(art),
            heatmapPlugin(() => danmaku.list()),
            ({ art }) => anime4k.attach(art),
            ({ art }) =>
              subtitles.attach(
                art,
                episodeSubtitles(),
                String(currentEpisodeIndexRef.current)
              ),
            // 实例销毁前：记住网页全屏
            () => () => releasePlayerResources(),
          ],
          artPlugins: () => [
            ...(isPlaybackThumbnailDisabled()
              ? []
              : [
                  artplayerPluginAutoThumbnail({
                    width: 160,
                    number: 100,
                    scale: 1,
                  }),
                ]),
            danmaku.artPlugin(artplayerPluginDanmuku),
          ],
          icons: {
            loading:
              '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
          },
          settings: buildSettings({
            anime4k,
            artPlayerRef,
            blockAdEnabled,
            danmakuHeatmapDisabledRef,
            danmakuHeatmapEnabledRef,
            formatQuickForwardDuration,
            formatTime,
            handleSkipConfigChange,
            quickForwardSecondsRef,
            resumeTimeRef,
            seekStepSecondsRef,
            setBlockAdEnabled,
            setDanmakuHeatmapEnabled,
            setQuickForwardSeconds,
            setSeekStepSeconds,
            setShowDanmakuFilterSettings,
            skipConfigRef,
            webGPUSupported,
          }),
          // 控制栏配置
          controls: buildControls({
            artPlayerRef,
            handleNextEpisode,
            isIOS,
            seekQuickForward,
          }),
        });

        const wireInstance = makeWireInstance({
          artPlayerRef,
          artRef,
          clearPlayerTimeouts,
          currentEpisodeIndexRef,
          currentIdRef,
          currentSourceRef,
          danmaku,
          detailRef,
          formatTime,
          handleNextEpisode,
          isEpisodeFilteredByTitle,
          isIOS,
          lastSaveTimeRef,
          lastSkipCheckRef,
          lastVolumeRef,
          nextEpisodeDanmakuPreloadTriggeredRef,
          nextEpisodePreCacheTriggeredRef,
          playRecordJumpDismissedRef,
          playRecordJumpInitialCheckRef,
          playRecordJumpLayerRef,
          restoreWebFullscreenOnReadyRef,
          resumePlayingAfterHlsModeSwitchRef,
          resumeTimeRef,
          saveCurrentPlayProgress,
          schedulePlayerTimeout,
          searchParams,
          seekStepSecondsRef,
          setCorsFailedUrl,
          setCurrentEpisodeIndex,
          setError,
          setIsVideoLoading,
          setIsWebFullscreen,
          setPlayerReady,
          setVideoError,
          skipConfigRef,
        });

        player.setHlsModes({
          harmonyNative: isHarmonyOS && harmonyHlsPlaybackMode === 'native',
          harmonyAdBlock: nativeHlsAdBlockEnabled,
          netdiskNative:
            supportsNativeHls && netdiskHlsPlaybackMode === 'native',
        });
        // 去广告开关改了：hls.js 的 loader 在创建时定下，要整体重建
        const recreate =
          activeAdBlockRef.current !== null &&
          activeAdBlockRef.current !== blockAdEnabled;
        activeAdBlockRef.current = blockAdEnabled;
        await player.load(
          {
            url: videoUrl,
            source: currentSourceRef.current,
            mediaType: videoMediaTypeRef.current,
            title: `${videoTitle} - ${playerEpisodeLabel}`,
            poster: videoCover,
            qualities: videoQualities,
          },
          { recreate }
        );
      } catch (err) {
        console.error('创建播放器失败:', err);
        setError('播放器初始化失败');
      }
    };

    // 调用异步初始化函数
    initPlayer();
  };
}
