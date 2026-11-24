/*
 * 自己看的播放页：取片源、选集、换源、弹幕面板、详情等页面状态，播放器交给内核 WatchPlayer。
 * 由 PlaybackSessionProvider 挂在根布局里，换页面不卸载（完整 / 小窗 / 收起是同一个实例）。
 */

'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import './PlaybackSurface.css';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  generateStorageKey,
  getAllPlayRecords,
  getSkipConfig,
} from '@/lib/db.client';
import { isEpisodeHiddenByFilter } from '@/lib/episode-filter';
import {
  buildEpisodeProgressContentKey,
  loadLocalEpisodeProgress,
  pruneLocalEpisodeProgressStorage,
  saveLocalEpisodeProgress,
} from '@/lib/episode-progress';
import type { EpisodeTitleCorrection } from '@/lib/episode-title-correction';
import {
  EPISODE_TITLE_CORRECTION_EVENT,
  getEpisodeTitleCorrection,
} from '@/lib/episode-title-correction';
import { logger } from '@/lib/logger';
import { isNetdiskSource, normalizeNetdiskSource } from '@/lib/netdisk/source';
import { isPrivilegedRole } from '@/lib/roles';
import { readJson, readSetting, writeSetting } from '@/lib/settings';
import { CUSTOM_SUBTITLE_ACCEPT } from '@/lib/subtitle-converter';
import { formatDuration } from '@/lib/time';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { useEnableAIComments } from '@/hooks/useEnableAIComments';
import { useEnableComments } from '@/hooks/useEnableComments';
import { useLatest } from '@/hooks/useLatest';
import { usePlaybackEpisode } from '@/hooks/usePlaybackEpisode';
import {
  usePlaybackSearchParams,
  usePlaybackSession,
} from '@/hooks/usePlaybackSession';

import DanmakuFilterSettings from '@/components/DanmakuFilterSettings';
import DownloadEpisodeSelector from '@/components/DownloadEpisodeSelector';
import EpisodeSelector from '@/components/EpisodeSelector';
import { notify } from '@/components/feedback/AppDialogs';
import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';
import SmartRecommendations from '@/components/SmartRecommendations';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { useDownload } from '@/contexts/DownloadContext';
import {
  type Art,
  type DanmakuState,
  type HlsInstance,
  type SourceSubtitle,
  Anime4KController,
  DanmakuController,
  LinkRefresher,
  SubtitleController,
  WatchPlayer,
} from '@/features/player';

import { useEpisodeNames } from './useEpisodeNames';
import { useFavorite } from './useFavorite';
import { useFilterConfigs } from './useFilterConfigs';
import { useNetdiskTmdbMerge } from './useNetdiskTmdbMerge';
import { usePlaybackFeatureFlags } from './usePlaybackFeatureFlags';
import { usePlayerPreferences } from './usePlayerPreferences';
import { makeLoadDoubanRating } from '../data/load-douban-rating';
import { makeLoadSourceDetail } from '../data/load-source-detail';
import {
  type TmdbPlayDetails,
  makeLoadTmdbBackdrop,
} from '../data/load-tmdb-backdrop';
import { makeHandleDownloadEpisode } from '../downloads/download-episode';
import { checkFileSystemDownload } from '../downloads/file-system-download';
import { makeCheckLocalDownload } from '../downloads/local-download';
import {
  type HarmonyHlsPlaybackMode,
  type NetdiskHlsPlaybackMode,
  HARMONY_HLS_PLAYBACK_MODE_KEY,
  NETDISK_HLS_PLAYBACK_MODE_KEY,
} from '../lib/hls-modes';
import { isHlsPlaybackUrl } from '../lib/playback-urls';
import {
  applyCorrection,
  applyCorrectionsToSources,
  getXiaoyaCorrection,
} from '../lib/xiaoya-correction';
import DanmakuSourceDialog from '../page/DanmakuSourceDialog';
import EpisodePanel from '../page/EpisodePanel';
import PansouDialog from '../page/PansouDialog';
import PlaybackComments from '../page/PlaybackComments';
import PlaybackDetail from '../page/PlaybackDetail';
import PlaybackDock from '../page/PlaybackDock';
import PlaybackDrawers, { usePlaybackDrawers } from '../page/PlaybackDrawers';
import PlaybackFailure from '../page/PlaybackFailure';
import PlaybackLoading from '../page/PlaybackLoading';
import PlaybackRail from '../page/PlaybackRail';
import PlaybackTitle from '../page/PlaybackTitle';
import PlaybackTools from '../page/PlaybackTools';
import ShortcutDialog from '../page/ShortcutDialog';
import type {
  FallbackRecommendation,
  PlaybackPanel,
  PlaybackSourceBadge,
  ShowToast,
} from '../page/types';
import VideoOverlays from '../page/VideoOverlays';
import { makeLoadPlayer } from '../player/load-player';
import { makeSaveCurrentPlayProgress } from '../player/save-progress';
import { makeHandleSkipConfigChange } from '../player/skip-config';
import { makeHandleCreateTranscodeSession } from '../player/transcode';
import { makeHandleSourceChange } from '../sources/change-source';
import { makePreferBestSource } from '../sources/prefer-best-source';
import { makeCalculateSourceScore } from '../sources/source-score';
import { makeFetchCurrentSourceVideoInfo } from '../sources/source-video-info';
import { makeUpdateVideoUrl } from '../sources/update-video-url';

function PlayPageClient() {
  const LOCAL_TRANSCODER_BASE_URL = 'http://localhost:19080';
  const router = useRouter();
  const searchParams = usePlaybackSearchParams();
  const playbackSession = usePlaybackSession();
  // 会话的几个方法单独拿出来，effect 的依赖只跟着它们变
  const { reportMedia, attachController, setMetadata, reloadPlayback } =
    playbackSession;
  const surfaceActiveRef = useRef(true);
  useEffect(() => {
    surfaceActiveRef.current = true;
    return () => {
      surfaceActiveRef.current = false;
    };
  }, []);
  const commitPlaybackHref = (url: URL) => {
    if (!surfaceActiveRef.current) return;
    const queueId = searchParams.get('queueId');
    if (queueId) url.searchParams.set('queueId', queueId);
    if (!playbackSession.updateHref(`${url.pathname}${url.search}`)) return;
    if (window.location.pathname === '/play')
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };
  const enableComments = useEnableComments();
  const enableAIComments = useEnableAIComments();
  const { addDownloadTask } = useDownload();
  const { siteName } = useSite();

  // 获取用户认证信息
  const authInfo =
    typeof window !== 'undefined' ? getAuthInfoFromBrowserCookie() : null;

  // 离线下载功能配置
  const enableOfflineDownload =
    typeof window !== 'undefined'
      ? window.RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD || false
      : false;
  const hasOfflinePermission = isPrivilegedRole(authInfo?.role);

  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  // 初始阶段/文案按入口定：带 source+id 是「获取详情」，directplay 是「准备直链」，
  // 都不该在首帧闪一下「搜索」（详见 initAll 里对应的赋值点）。
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >(() =>
    searchParams.get('source') && searchParams.get('id')
      ? 'fetching'
      : 'searching'
  );
  const [loadingMessage, setLoadingMessage] = useState(() =>
    searchParams.get('source') === 'directplay'
      ? '正在准备直链播放...'
      : searchParams.get('source') && searchParams.get('id')
      ? '正在获取视频详情...'
      : '正在搜索播放源...'
  );
  // 加载步骤模型的入口参数只在首帧定格：initAll 拿到详情后会把 source/id 写回 URL、
  // 删掉 prefer（见 ~5814），若让步骤跟着 searchParams 现算，方格会在「就绪」那一刻
  // 从 搜索/优选/就绪(3 格) 塌成 详情/就绪(2 格)。冻结进入时的参数避免这次切换。
  const [initialLoadParams] = useState(() => ({
    source: searchParams.get('source'),
    id: searchParams.get('id'),
    prefer: searchParams.get('prefer'),
  }));
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);

  // TMDB背景图
  const [tmdbBackdrop, setTmdbBackdrop] = useState<string | null>(null);
  // TMDB 分集名称（按 episode_number-1 索引），复用背景请求解析出的 tmdbId 获取
  const [tmdbEpisodeNames, setTmdbEpisodeNames] = useState<string[]>([]);
  // 背景请求解析出的 tmdbId 字符串（形如 "tv:123"），供拉取分集名复用
  const [resolvedTmdbIdStr, setResolvedTmdbIdStr] = useState<string | null>(
    null
  );
  // 已发起 TMDB 分集名请求的 id，避免重复拉取
  const tmdbEpisodesFetchedIdRef = useRef<string | null>(null);
  // 「禁用集数标题获取并切换」全局开关（本地设置，进入播放页时读取一次）
  const [globalTitleFetchDisabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return readSetting('disableEpisodeTitleFetch') === 'true';
  });
  // 「手动矫正标题」按剧集配置：随当前标题 / 用户矫正而更新
  const [titleCorrection, setTitleCorrection] =
    useState<EpisodeTitleCorrection>({});

  const { netdiskSearchEnabled, aiEnabled, aiDefaultMessageWithVideo } =
    usePlaybackFeatureFlags();

  // 快捷键说明弹窗状态
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);

  // 面板用右侧抽屉还是底部面板：除了手机竖屏都用抽屉，和房间面板同一规则（lib/device-tier.ts）
  const isLargeScreen = useDeviceTier() !== 'phone';
  const drawers = usePlaybackDrawers(isLargeScreen);
  const openDrawer = drawers.show;

  // 网页全屏状态 - 控制导航栏的显示隐藏
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);

  // 组件卸载时停掉链接续期
  useEffect(() => {
    return () => {
      linkRefresherRef.current?.clear();
    };
  }, []);

  const {
    setSkipConfig,
    skipConfigRef,
    setQuickForwardSeconds,
    quickForwardSecondsRef,
    setSeekStepSeconds,
    seekStepSecondsRef,
    blockAdEnabled,
    setBlockAdEnabled,
    blockAdEnabledRef,
    externalPlayerAdBlock,
    setExternalPlayerAdBlock,
    danmakuHeatmapDisabledRef,
    setDanmakuHeatmapEnabled,
    danmakuHeatmapEnabledRef,
  } = usePlayerPreferences();

  // 跳过检查的时间间隔控制
  const lastSkipCheckRef = useRef(0);

  // Anime4K 超分（内核 Anime4KController：开着时新实例自动重新启动；模式、倍数记在本机）
  const anime4kRef = useRef<Anime4KController | null>(null);
  const anime4k = (anime4kRef.current ??= new Anime4KController());

  // 弹幕（内核 DanmakuController，和房间同一份）：自动匹配、手动选、上传、过滤、数量上限、下一集预加载
  // 整个页面只建一个（惰性初始值只跑一次），依赖它的 effect 不会每次渲染都重跑
  const [danmaku] = useState(
    () =>
      new DanmakuController((text) => {
        if (artPlayerRef.current) artPlayerRef.current.notice.show = text;
      })
  );
  const [danmakuState, setDanmakuState] = useState<DanmakuState>(danmaku.state);
  useEffect(() => {
    setDanmakuState(danmaku.state);
    const unsubscribe = danmaku.subscribe(setDanmakuState);
    return () => {
      unsubscribe();
    };
  }, [danmaku]);
  const {
    episodeFilterConfig,
    setEpisodeFilterConfig,
    episodeFilterConfigRef,
  } = useFilterConfigs(danmaku);
  const [showDanmakuFilterSettings, setShowDanmakuFilterSettings] =
    useState(false);
  const showToast: ShowToast = (message, type) => notify(message, type);
  const [isTranscoding, setIsTranscoding] = useState(false);

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [videoDoubanId, setVideoDoubanId] = useState(0);

  // 更新浏览器标题
  useEffect(() => {
    if (videoTitle) {
      document.title = `${siteName} - ${videoTitle}`;
    } else {
      document.title = siteName;
    }
  }, [videoTitle, siteName]);
  // 豆瓣评分数据
  const [doubanRating, setDoubanRating] = useState<{
    value: number;
    count: number;
    star_count: number;
  } | null>(null);
  // 豆瓣额外信息
  const [doubanCardSubtitle, setDoubanCardSubtitle] = useState<string>('');
  const [doubanAka, setDoubanAka] = useState<string[]>([]);
  const [doubanYear, setDoubanYear] = useState<string>(''); // 从 pubdate 提取的年份

  // 纠错后的描述信息（用于显示，不触发 detail 更新）
  const [correctedDesc, setCorrectedDesc] = useState<string>('');
  const [netdiskTMDBMeta, setNetdiskTMDBMeta] = useState<{
    desc?: string;
    poster?: string;
    year?: string;
    tmdbId?: number;
  } | null>(null);
  const [pendingNetdiskTMDBData, setPendingNetdiskTMDBData] =
    useState<TmdbPlayDetails | null>(null);

  // 当前源和ID - source 直接存储完整格式（如 'emby_wumei' 或 'emby'）
  const [currentSource, setCurrentSource] = useState(
    normalizeNetdiskSource(searchParams.get('source')) || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');
  const [fileName] = useState(searchParams.get('fileName') || ''); // 小雅源：用户点击的文件名
  const isDirectPlay = currentSource === 'directplay';

  useEffect(() => {
    setNetdiskTMDBMeta(null);
    setPendingNetdiskTMDBData(null);
  }, [currentSource, currentId]);

  const isLazyDetailSource = (source?: string) => {
    if (!source) return false;
    return (
      source === 'openlist' ||
      source === 'emby' ||
      source.startsWith('emby_') ||
      source.startsWith('script:')
    );
  };

  /** 网盘挂载类源：openlist / xiaoya / netdisk-* 等挂载网盘，视频无广告，可用原生 HLS 直连播放 */
  const isNetdiskMountSource = (source?: string | null) => {
    if (!source) return false;
    return (
      source === 'openlist' || source === 'xiaoya' || isNetdiskSource(source)
    );
  };

  const isM3u8LikeUrl = (url?: string) => {
    if (!url) return false;
    const normalizedUrl = url.toLowerCase();
    return normalizedUrl.includes('.m3u8') || normalizedUrl.includes('/m3u8/');
  };

  const buildAbsoluteUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');
  const [initialEpisodeProgressTitle] = useState(
    searchTitle || searchParams.get('title') || ''
  );
  const [initialEpisodeProgressYear] = useState(searchParams.get('year') || '');

  // 全局开关或「本剧集被禁用」任一命中即禁用集数标题获取；
  // 矫正配置按标题（与传给 EpisodeSelector 的 videoTitle 一致）读取，随标题变化与矫正事件同步
  const episodeTitleFetchDisabled =
    globalTitleFetchDisabled || !!titleCorrection.disabled;
  useEffect(() => {
    const key = searchTitle || videoTitle;
    const sync = () => setTitleCorrection(getEpisodeTitleCorrection(key));
    sync();
    window.addEventListener(EPISODE_TITLE_CORRECTION_EVENT, sync);
    return () =>
      window.removeEventListener(EPISODE_TITLE_CORRECTION_EVENT, sync);
  }, [searchTitle, videoTitle]);
  const episodeProgressContentKey = useMemo(
    () =>
      buildEpisodeProgressContentKey({
        doubanId: videoDoubanId || detail?.douban_id,
        tmdbId: detail?.tmdb_id,
        title: initialEpisodeProgressTitle,
        year: initialEpisodeProgressYear,
        searchType,
      }),
    [
      detail?.douban_id,
      detail?.tmdb_id,
      initialEpisodeProgressTitle,
      initialEpisodeProgressYear,
      searchType,
      videoDoubanId,
    ]
  );

  // 是否需要优选
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true'
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);
  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = usePlaybackEpisode(
    searchParams.get('episode')
  );

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
  }, [currentEpisodeIndex]);

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
  const linkRefresherRef = useRef<LinkRefresher | null>(null);
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
  const suppressPlayRecordJumpOnNextEpisodeChangeRef = useRef(false); // 主动切集时不显示播放记录跳转提示

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
  // 播放记录跳转按钮状态
  const playRecordJumpDismissedRef = useRef(false); // 记录用户是否已经关闭过跳转按钮
  const playRecordJumpLayerRef = useRef<HTMLElement | null>(null); // 保存跳转按钮层的引用
  const playRecordJumpInitialCheckRef = useRef(true); // 记录是否是首次检查播放记录
  // 上次使用的音量，默认 0.7
  const lastVolumeRef = useRef<number>(0.7);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null
  );
  const [fallbackRecommendations, setFallbackRecommendations] = useState<
    FallbackRecommendation[]
  >([]);
  const [hasCompletedSearchRequest, setHasCompletedSearchRequest] =
    useState(false);
  const [backgroundSourcesLoading, setBackgroundSourcesLoading] =
    useState(false);

  useEffect(() => {
    try {
      pruneLocalEpisodeProgressStorage();
    } catch (error) {
      logger.warn('[Play] Failed to prune local episode progress:', error);
    }
  }, []);

  // 优选和测速开关
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = readSetting('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  const [preferStrategy] = useState<'fast' | 'full'>(() => {
    if (typeof window !== 'undefined') {
      const saved = readSetting('preferStrategy');
      if (saved === 'fast' || saved === 'full') {
        return saved;
      }
    }
    return 'fast';
  });

  // 优选偏好：综合判定(balanced) / 分辨率优先(resolution) / 网速优先(speed)
  const [preferMode] = useState<'balanced' | 'resolution' | 'speed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = readSetting('preferMode');
      if (saved === 'balanced' || saved === 'resolution' || saved === 'speed') {
        return saved;
      }
    }
    return 'balanced';
  });

  // 保存优选时的测速结果，避免EpisodeSelector重复测速
  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<
      string,
      { quality: string; loadSpeed: string; pingTime: number; bitrate: string }
    >
  >(new Map());

  // 当前源的视频信息（用于标题旁边显示）
  const [currentSourceVideoInfo, setCurrentSourceVideoInfo] = useState<{
    quality: string;
    loadSpeed: string;
    pingTime: number;
    bitrate: string;
  } | null>(null);

  // 折叠状态（仅在 lg 及以上屏幕有效）
  // 电脑上一开始只露右侧图标栏，点“选集 / 换源 / 弹幕”再展开面板
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(true);

  // 手机 / 平板：底部操作坞打开的半屏面板；电脑：右侧图标栏选中的面板
  const [soloSheet, setSoloSheet] = useState<PlaybackPanel | 'tools' | null>(
    null
  );
  const [soloRail, setSoloRail] = useState<PlaybackPanel>('episodes');
  const [selectorRequest, setSelectorRequest] = useState<{
    tab: PlaybackPanel;
    nonce: number;
  } | null>(null);
  const openSoloSheet = (panel: PlaybackPanel | 'tools') => {
    if (panel !== 'tools')
      setSelectorRequest({ tab: panel, nonce: Date.now() });
    setSoloSheet(panel);
    // 面板盖住下半屏：把画面滚到最上面，面板正好接在画面下方
    const frame = document.querySelector<HTMLElement>(
      '.tm-playback-host[data-presentation="full"] .tm-playback-video-frame'
    );
    if (frame) {
      // 顶栏是固定的：画面停在顶栏下面
      const header = document.querySelector<HTMLElement>(
        '.tm-mobile-header-v2, .tm-top-header'
      );
      const headerHeight =
        header && getComputedStyle(header).display !== 'none'
          ? header.getBoundingClientRect().bottom
          : 0;
      const top =
        frame.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      // 页面短、滚不上去时，面板就从画面下沿开始
      const host = frame.closest<HTMLElement>('.tm-playback-host');
      host?.style.setProperty(
        '--tm-solo-sheet-top',
        `${Math.round(frame.getBoundingClientRect().bottom)}px`
      );
    }
  };
  const selectSoloRail = (panel: PlaybackPanel) => {
    if (!isEpisodeSelectorCollapsed && soloRail === panel) {
      setIsEpisodeSelectorCollapsed(true);
      return;
    }
    setIsEpisodeSelectorCollapsed(false);
    setSoloRail(panel);
    setSelectorRequest({ tab: panel, nonce: Date.now() });
  };
  useEffect(() => {
    if (!soloSheet) return;
    const close = (event: KeyboardEvent) =>
      event.key === 'Escape' && setSoloSheet(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [soloSheet]);

  // 下载选集面板显示状态
  const [showDownloadSelector, setShowDownloadSelector] = useState(false);

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging' | 'episodeChanging'
  >('initing');
  const [videoError, setVideoError] = useState<string | null>(null);
  // 直链播放时 CORS 失败的原始 URL，用于显示"使用代理播放"按钮
  const [corsFailedUrl, setCorsFailedUrl] = useState<string | null>(null);
  // 标记当前视频是否已经尝试过代理（防止 415→直连→失败→代理 的无限循环）
  const proxyAttemptedRef = useRef(false);
  const videoUrlRequestSeqRef = useRef(0);
  const lastVideoRequestKeyRef = useRef<string | null>(null);

  // 直链代理域名记忆：检查某个域名是否需要代理
  const isDirectplayDomainProxied = (url: string): boolean => {
    try {
      const domain = new URL(url).hostname;
      return readJson<string[]>('directplay_proxy_domains', []).includes(
        domain
      );
    } catch {
      return false;
    }
  };
  // 将域名记录到代理列表
  const addDirectplayProxyDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      const domains = readJson<string[]>('directplay_proxy_domains', []);
      if (!domains.includes(domain)) {
        domains.push(domain);
        writeSetting('directplay_proxy_domains', JSON.stringify(domains));
      }
    } catch {
      /* ignore */
    }
  };

  // 播放器就绪状态（用于触发 usePlaySync 的事件监听器设置）
  const [playerReady, setPlayerReady] = useState(false);

  // 播放进度保存相关
  const lastSaveTimeRef = useRef<number>(0);
  const lastSavedPlayTimeRef = useRef<number | null>(null);

  // 下集预缓存相关
  const nextEpisodePreCacheTriggeredRef = useRef<boolean>(false);
  const nextEpisodePreCacheHlsRef = useRef<HlsInstance | null>(null);
  const nextEpisodeDanmakuPreloadTriggeredRef = useRef<boolean>(false);

  const artPlayerRef = useRef<Art | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  // 换集重建播放器前记住网页全屏状态，新播放器 ready 后恢复
  const restoreWebFullscreenOnReadyRef = useRef(false);
  // 播放器内核：实例在完整 / 小窗 / 收起之间保留，换集换源由它决定换地址还是重建
  const watchPlayerRef = useRef<WatchPlayer | null>(null);
  const stopKeyboardRef = useRef<(() => void) | null>(null);
  // 当前实例创建时的去广告开关（变了就要重建）
  const activeAdBlockRef = useRef<boolean | null>(null);
  const customSubtitleInputRef = useRef<HTMLInputElement | null>(null);
  // 字幕（内核 SubtitleController，和房间同一份）：片源字幕、本地上传、ASS/SSA、PGS/SUP
  const subtitlesRef = useRef<SubtitleController | null>(null);
  const subtitles = (subtitlesRef.current ??= new SubtitleController(
    (message, type) =>
      notify(message, type, type === 'info' ? { duration: 5000 } : {}),
    () => customSubtitleInputRef.current?.click()
  ));
  const episodeSubtitles = () =>
    (detailRef.current?.subtitles?.[currentEpisodeIndexRef.current] ||
      []) as SourceSubtitle[];

  const mediaReady = Boolean(
    playerReady && !isVideoLoading && !loading && videoUrl
  );
  const queueItemId = searchParams.get('queueId') || undefined;
  useEffect(() => {
    if (!currentSource || !currentId) {
      reportMedia(null);
      return;
    }
    reportMedia({
      source: currentSource,
      videoId: String(currentId),
      episode: currentEpisodeIndex + 1,
      videoName: videoTitle || detail?.title || '',
      videoYear: videoYear || detail?.year || '',
      searchTitle: searchTitle || '',
      poster: detail?.poster || '',
      url: videoUrl || '',
      queueItemId,
      ready: mediaReady,
    });
  }, [
    currentSource,
    currentId,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
    searchTitle,
    detail?.title,
    detail?.year,
    detail?.poster,
    videoUrl,
    queueItemId,
    mediaReady,
    reportMedia,
  ]);
  const reportMediaLatest = useLatest(reportMedia);
  useEffect(
    () => () => reportMediaLatest.current(null),
    // 卸载时清空：这个播放实例不再在放任何影片
    [reportMediaLatest]
  );
  const watchRoomContext = useWatchRoomContextSafe();
  useEffect(() => {
    if (!playerReady || !artPlayerRef.current) return;
    attachController(artPlayerRef.current);
    return () => attachController(null);
  }, [playerReady, attachController]);
  useEffect(() => {
    setMetadata({
      title: videoTitle || detail?.title || '正在准备影片',
      episode: currentEpisodeIndex + 1,
      poster: detail?.poster,
      loading,
      error: error || videoError,
      episodeTitles: Array.from(
        { length: detail?.episodes?.length || 0 },
        (_, index) => detail?.episodes_titles?.[index] || ''
      ),
    });
  }, [
    videoTitle,
    detail?.title,
    detail?.poster,
    detail?.episodes?.length,
    detail?.episodes_titles,
    currentEpisodeIndex,
    loading,
    error,
    videoError,
    setMetadata,
  ]);
  // 切集后把集数写回播放地址（不重建播放器）。否则地址仍是上一集：
  // 刷新、复制链接、带着当前影片开房间时都会被当成另一部片而重新加载。
  const commitPlaybackHrefLatest = useLatest(commitPlaybackHref);
  const playbackSessionLatest = useLatest(playbackSession);
  useEffect(() => {
    if (loading || !detail || !currentSource || !currentId) return;
    if (
      detail.source !== currentSource ||
      String(detail.id) !== String(currentId)
    )
      return;
    const current = new URL(
      playbackSessionLatest.current.href || '/play',
      window.location.origin
    );
    if (current.pathname !== '/play') return;
    const episode = String(currentEpisodeIndex + 1);
    if (current.searchParams.get('episode') === episode) return;
    current.searchParams.set('episode', episode);
    commitPlaybackHrefLatest.current(current);
  }, [
    currentEpisodeIndex,
    detail,
    currentSource,
    currentId,
    loading,
    commitPlaybackHrefLatest,
    playbackSessionLatest,
  ]);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const handleCreateWatchRoom = async () => {
    const watchRoom = watchRoomContext;
    if (watchRoom?.currentRoom) {
      router.push(
        `/watch-room?room=${encodeURIComponent(watchRoom.currentRoom.id)}`
      );
      return;
    }
    if (!watchRoom || !watchRoom.isConnected) {
      notify('观影室服务未连接', 'error', { duration: 3000 });
      return;
    }

    setIsCreatingRoom(true);
    try {
      const room = await watchRoom.createRoom({
        name: (videoTitle || detail?.title || '一起看').slice(0, 50),
        description: '',
        isPublic: false,
        roomType: 'sync',
        userName: authInfo?.username || '游客',
      });
      // 创建成功直接进房间页：同一个播放实例从整页变成房间里的画面，不会重建；
      // 空房间会自动接着这部影片和当前进度一起看（RoomPlaybackBridge）。
      router.push(`/watch-room?room=${encodeURIComponent(room.id)}`);
    } catch (error) {
      notify((error as Error | null)?.message || '创建观影室失败', 'error', {
        duration: 3000,
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // -----------------------------------------------------------------------------
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
    searchParams,
    currentSource,
    currentId,
    availableSources,
    currentEpisodeIndex,
    reloadPlaybackLatest,
    setCurrentEpisodeIndexLatest,
  ]);

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
  }, [detail, currentEpisodeIndex, subtitlesLatest]);

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
  useEffect(() => {
    // 页面即将卸载时保存播放进度和清理资源
    const handleBeforeUnload = () => {
      saveCurrentPlayProgressLatest.current();
      cleanupPlayer();
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
  }, [currentEpisodeIndex, detail, saveCurrentPlayProgressLatest]);

  // ---------------------------------------------------------------------------
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
  useEffect(() => {
    return () => {
      // 销毁播放器实例
      cleanupPlayer();
    };
  }, []);

  if (loading) {
    return (
      <PageLayout activePath='/play' hideNavigation={isWebFullscreen}>
        <PlaybackLoading
          entry={initialLoadParams}
          stage={loadingStage}
          message={loadingMessage}
          optimizationEnabled={optimizationEnabled}
        />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play' hideNavigation={isWebFullscreen}>
        <PlaybackFailure
          error={error}
          entry={initialLoadParams}
          stage={loadingStage}
          optimizationEnabled={optimizationEnabled}
          videoTitle={videoTitle}
          searchTitle={searchTitle}
          recommendations={
            hasCompletedSearchRequest ? fallbackRecommendations : []
          }
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play' hideNavigation={isWebFullscreen}>
      {/* TMDB背景图 */}
      {tmdbBackdrop && (
        <div
          className='tm-psurface-div-1'
          style={{
            backgroundImage: `url(${tmdbBackdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(5px) brightness(0.7)',
          }}
        />
      )}
      {danmakuState.matches.length > 0 && (
        <DanmakuSourceDialog
          matches={danmakuState.matches}
          onSelect={(anime, index) => void danmaku.selectSource(anime, index)}
          onCancel={() => danmaku.dismissMatches()}
        />
      )}

      <div className='tm-page-container tm-psurface-div-2 tm-solo-page'>
        {/* 第一行：影片标题 */}
        <PlaybackTitle
          detail={detail}
          videoTitle={videoTitle}
          videoYear={videoYear}
          doubanYear={doubanYear}
          doubanRating={doubanRating}
          episodeLabel={shouldShowEpisodeLabel ? episodeLabel : null}
          sourceBadge={playbackSourceBadge}
          onArt={!!tmdbBackdrop}
          totalEpisodes={totalEpisodes}
        />
        {/* 第二行：播放器和选集 */}
        <div className='tm-psurface-div-3 tm-solo-row'>
          <div
            // 手机 / 平板上和标题之间留 8px（电脑档不留，见 PlaybackSurface.css）
            className={`tm-psurface-div-4 ${
              isEpisodeSelectorCollapsed
                ? 'tm-psurface-div-5'
                : 'tm-psurface-div-6'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`tm-psurface-div-7 ${
                isEpisodeSelectorCollapsed
                  ? 'tm-psurface-div-8'
                  : 'tm-psurface-div-9'
              }`}
            >
              {/* 播放器容器 */}
              <div className='tm-playback-video-frame tm-psurface-div-10'>
                <div
                  ref={artRef}
                  data-tm-player-mount
                  className='tm-psurface-div-11'
                ></div>

                <VideoOverlays
                  loading={isVideoLoading}
                  stage={videoLoadingStage}
                  error={videoError}
                  canUseProxy={
                    !proxyAttemptedRef.current &&
                    Boolean(
                      corsFailedUrl ||
                        (isDirectPlay &&
                          videoUrl &&
                          !videoUrl.includes('/api/proxy-m3u8'))
                    )
                  }
                  onRetry={() => {
                    setVideoError(null);
                    setIsVideoLoading(true);
                    // 重新加载视频
                    if (artPlayerRef.current) {
                      artPlayerRef.current.url = videoUrl;
                    }
                  }}
                  onUseProxy={() => {
                    const originalUrl = corsFailedUrl || videoUrl;
                    // 记忆域名到 localStorage
                    addDirectplayProxyDomain(originalUrl);
                    const proxyUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
                      originalUrl
                    )}&source=directplay`;
                    // 清除错误状态并重新播放
                    setVideoError(null);
                    setCorsFailedUrl(null);
                    setIsVideoLoading(true);
                    proxyAttemptedRef.current = true;
                    setVideoUrl(proxyUrl);
                  }}
                  refreshingLink={isRefreshingUrl}
                  danmakuLoading={danmakuState.loading}
                  danmakuCount={danmakuState.count}
                  danmakuOriginalCount={danmakuState.originalCount}
                />
              </div>

              {videoUrl && (
                <PlaybackTools
                  open={soloSheet === 'tools'}
                  onClose={() => setSoloSheet(null)}
                  videoUrl={videoUrl}
                  originalUrl={
                    // 代理播放时交出原始地址
                    sourceProxyMode &&
                    detail?.episodes &&
                    currentEpisodeIndex < detail.episodes.length
                      ? detail.episodes[currentEpisodeIndex]
                      : videoUrl
                  }
                  currentSource={currentSource}
                  videoTitle={videoTitle}
                  externalPlayerAdBlock={externalPlayerAdBlock}
                  onToggleAdBlock={toggleToolbarAdBlock}
                  onDownload={() => setShowDownloadSelector(true)}
                  onShowShortcuts={() => setShowShortcutDialog(true)}
                  roomEntry={
                    watchRoomContext?.isEnabled && watchRoomContext.isConnected
                      ? watchRoomContext.currentRoom
                        ? 'return'
                        : 'create'
                      : null
                  }
                  creatingRoom={isCreatingRoom}
                  onRoom={() => void handleCreateWatchRoom()}
                  canTranscode={showExternalTranscodeButton}
                  transcoding={isTranscoding}
                  onTranscode={handleCreateTranscodeSession}
                  harmonyMode={isHarmonyOS ? harmonyHlsPlaybackMode : null}
                  onHarmonyMode={switchHarmonyHlsPlaybackMode}
                  netdiskMode={
                    isNetdiskMountSource(currentSource) && supportsNativeHls
                      ? netdiskHlsPlaybackMode
                      : null
                  }
                  onNetdiskMode={switchNetdiskHlsPlaybackMode}
                  showToast={showToast}
                />
              )}
            </div>

            {/* 选集和换源 - 在移动端始终显示，在电脑上可折叠 */}
            <EpisodePanel
              open={Boolean(soloSheet && soloSheet !== 'tools')}
              collapsed={isEpisodeSelectorCollapsed}
              onClose={() => setSoloSheet(null)}
            >
              <EpisodeSelector
                requestedTab={selectorRequest}
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                richEpisodeNames={richEpisodeNames}
                value={currentEpisodeIndex + 1}
                onChange={(episodeNumber: number) => {
                  handleEpisodeChange(episodeNumber);
                  setSoloSheet(null);
                }}
                onSourceChange={handleSourceChange}
                isRoomMember={false}
                currentSource={currentSource}
                currentId={currentId}
                episodeProgressContentKey={
                  episodeProgressContentKey || undefined
                }
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                backgroundSourcesLoading={backgroundSourcesLoading}
                precomputedVideoInfo={precomputedVideoInfo}
                useLightTextOnBackdrop={!!tmdbBackdrop}
                onDanmakuSelect={(selection) =>
                  void danmaku.select(selection, true)
                }
                onDanmakuEpisodesLoaded={(episodes) =>
                  danmaku.setEpisodes(episodes)
                }
                currentDanmakuSelection={danmakuState.selection}
                onUploadDanmaku={(comments) => void danmaku.upload(comments)}
                episodeFilterConfig={episodeFilterConfig}
                onFilterConfigUpdate={setEpisodeFilterConfig}
                onShowToast={showToast}
              />
            </EpisodePanel>
          </div>

          {/* 电脑：右侧图标栏，选集 / 换源 / 弹幕开合右边的面板，其余打开抽屉 */}
          <PlaybackRail
            activePanel={isEpisodeSelectorCollapsed ? null : soloRail}
            onPanel={selectSoloRail}
            showTools={Boolean(videoUrl)}
            toolsOpen={soloSheet === 'tools'}
            onToggleTools={() =>
              setSoloSheet(soloSheet === 'tools' ? null : 'tools')
            }
            showDetail={Boolean(detail)}
            showAiChat={Boolean(aiEnabled && detail)}
            showNetdisk={netdiskSearchEnabled}
            onDrawer={openDrawer}
            onShortcuts={() => setShowShortcutDialog(true)}
          />
        </div>

        <PlaybackDock
          sheetOpen={Boolean(soloSheet)}
          onOpen={openSoloSheet}
          onClose={() => setSoloSheet(null)}
          episodeHint={
            totalEpisodes > 1 ? `第 ${currentEpisodeIndex + 1} 集` : '正片'
          }
          sourceName={detail?.source_name || '片源'}
          danmakuCount={danmakuState.count}
          showTools={Boolean(videoUrl)}
          detailHint={
            detail
              ? doubanRating && doubanRating.value > 0
                ? `豆瓣 ${doubanRating.value.toFixed(1)}`
                : '简介'
              : null
          }
          onDetail={() => openDrawer('detail')}
        />

        {!isDirectPlay && (
          <>
            {/* 详情展示 */}
            <PlaybackDetail
              detail={detail}
              videoTitle={videoTitle}
              videoYear={videoYear}
              videoCover={videoCover}
              videoDoubanId={videoDoubanId}
              doubanYear={doubanYear}
              doubanAka={doubanAka}
              doubanCardSubtitle={doubanCardSubtitle}
              doubanRating={doubanRating}
              correctedDesc={correctedDesc}
              netdiskTMDBMeta={netdiskTMDBMeta}
              sourceInfo={currentSourceVideoInfo}
              onSourceInfo={() => void fetchCurrentSourceVideoInfo()}
              favorited={favorited}
              onToggleFavorite={() => void handleToggleFavorite()}
              aiEnabled={aiEnabled}
              netdiskSearchEnabled={netdiskSearchEnabled}
              onDrawer={openDrawer}
              onArt={!!tmdbBackdrop}
            />

            {/* 推荐区域 */}
            <SmartRecommendations
              doubanId={videoDoubanId !== 0 ? videoDoubanId : undefined}
              videoTitle={videoTitle}
            />

            <PlaybackComments
              enableAIComments={enableAIComments}
              enableComments={enableComments}
              videoDoubanId={videoDoubanId}
              videoTitle={videoTitle}
            />
          </>
        )}
      </div>

      {/* Toast通知 */}

      <input
        ref={customSubtitleInputRef}
        type='file'
        accept={CUSTOM_SUBTITLE_ACCEPT}
        className='tm-psurface-input-1'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void subtitles.loadFile(file);
        }}
      />

      {/* 下载选集面板 */}
      <DownloadEpisodeSelector
        isOpen={showDownloadSelector}
        onClose={() => setShowDownloadSelector(false)}
        totalEpisodes={totalEpisodes}
        episodesTitles={detail?.episodes_titles || []}
        videoTitle={videoTitle}
        currentEpisodeIndex={currentEpisodeIndex}
        onDownload={handleDownloadEpisode}
        enableOfflineDownload={enableOfflineDownload}
        hasOfflinePermission={hasOfflinePermission}
      />

      {/* 弹幕过滤设置对话框 */}
      <DanmakuFilterSettings
        isOpen={showDanmakuFilterSettings}
        onClose={() => setShowDanmakuFilterSettings(false)}
        onConfigUpdate={(config) => {
          // 新规则马上作用到屏幕上的弹幕
          danmaku.setFilter(config);
          try {
            danmaku.plugin?.load();
          } catch {
            // 插件还没就绪
          }
        }}
        onShowToast={(message, type) => {
          notify(message, type);
        }}
      />

      {showShortcutDialog && (
        <ShortcutDialog onClose={() => setShowShortcutDialog(false)} />
      )}

      {drawers.open.pansou && (
        <PansouDialog
          keyword={detail?.title || ''}
          drawer={isLargeScreen}
          onClose={() => drawers.close('pansou')}
        />
      )}

      <PlaybackDrawers
        open={drawers.open}
        onClose={drawers.close}
        drawerMode={isLargeScreen}
        detail={detail}
        videoDoubanId={videoDoubanId}
        currentEpisode={currentEpisodeIndex + 1}
        aiEnabled={aiEnabled}
        aiWelcomeTemplate={aiDefaultMessageWithVideo}
        onCorrected={handleCorrectSuccess}
      />
    </PageLayout>
  );
}

export default function PlaybackSurface() {
  return (
    <Suspense
      fallback={
        <div className='tm-public-feedback' role='status'>
          正在加载播放器…
        </div>
      }
    >
      <PlayPageClient />
    </Suspense>
  );
}
