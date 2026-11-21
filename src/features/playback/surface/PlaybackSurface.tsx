/*
 * 自己看的播放页：取片源、选集、换源、弹幕面板、详情等页面状态，播放器交给内核 WatchPlayer。
 * 由 PlaybackSessionProvider 挂在根布局里，换页面不卸载（完整 / 小窗 / 收起是同一个实例）。
 */

'use client';

import { useRouter } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isAnimeCategoryText } from '@/lib/anime-keyword-expr';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { initDanmakuModule } from '@/lib/danmaku/api';
import { cleanEpisodeDisplayName } from '@/lib/danmaku/format';
import {
  deleteFavorite,
  generateStorageKey,
  getAllPlayRecords,
  getDanmakuFilterConfig,
  getEpisodeFilterConfig,
  getSkipConfig,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import {
  isEpisodeHiddenByFilter,
  normalizeEpisodeFilterConfig,
} from '@/lib/episode-filter';
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
import { isNetdiskSource, normalizeNetdiskSource } from '@/lib/netdisk/source';
import {
  DEFAULT_QUICK_FORWARD_SECONDS,
  DEFAULT_SEEK_STEP_SECONDS,
  loadStoredSeconds,
  QUICK_FORWARD_STORAGE_KEY,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';
import { CUSTOM_SUBTITLE_ACCEPT } from '@/lib/subtitle-converter';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { EpisodeFilterConfig, SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { useEnableAIComments } from '@/hooks/useEnableAIComments';
import { useEnableComments } from '@/hooks/useEnableComments';
import { usePlaybackEpisode } from '@/hooks/usePlaybackEpisode';
import {
  usePlaybackSearchParams,
  usePlaybackSession,
} from '@/hooks/usePlaybackSession';

import DanmakuFilterSettings from '@/components/DanmakuFilterSettings';
import DownloadEpisodeSelector from '@/components/DownloadEpisodeSelector';
import EpisodeSelector from '@/components/EpisodeSelector';
import Toast, { ToastProps } from '@/components/feedback/Toast';
import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';
import SmartRecommendations from '@/components/SmartRecommendations';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { useDownload } from '@/contexts/DownloadContext';
import {
  type DanmakuState,
  type SourceSubtitle,
  Anime4KController,
  DanmakuController,
  LinkRefresher,
  SubtitleController,
  WatchPlayer,
} from '@/features/player';

import { makeLoadDoubanRating } from '../data/load-douban-rating';
import { makeLoadSourceDetail } from '../data/load-source-detail';
import { makeLoadTmdbBackdrop } from '../data/load-tmdb-backdrop';
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
import { seriesStatus } from '../lib/series-status';
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

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

function PlayPageClient() {
  const LOCAL_TRANSCODER_BASE_URL = 'http://localhost:19080';
  const router = useRouter();
  const searchParams = usePlaybackSearchParams();
  const playbackSession = usePlaybackSession();
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
      ? (window as any).RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD || false
      : false;
  const hasOfflinePermission =
    authInfo?.role === 'owner' || authInfo?.role === 'admin';

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
      ? '🎬 正在准备直链播放...'
      : searchParams.get('source') && searchParams.get('id')
      ? '🎬 正在获取视频详情...'
      : '🔍 正在搜索播放源...'
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
    return localStorage.getItem('disableEpisodeTitleFetch') === 'true';
  });
  // 「手动矫正标题」按剧集配置：随当前标题 / 用户矫正而更新
  const [titleCorrection, setTitleCorrection] =
    useState<EpisodeTitleCorrection>({});

  // 收藏状态
  const [favorited, setFavorited] = useState(false);

  // 网盘搜索是否开启
  const [netdiskSearchEnabled, setNetdiskSearchEnabled] = useState(false);

  // AI问片状态
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDefaultMessageWithVideo, setAiDefaultMessageWithVideo] =
    useState('');

  // 快捷键说明弹窗状态
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);

  // 面板用右侧抽屉还是底部面板：除了手机竖屏都用抽屉，和房间面板同一规则（lib/device-tier.ts）
  const isLargeScreen = useDeviceTier() !== 'phone';
  const drawers = usePlaybackDrawers(isLargeScreen);
  const openDrawer = drawers.show;

  // 检查AI功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        (window as any).RUNTIME_CONFIG?.AI_ENABLED &&
        (window as any).RUNTIME_CONFIG?.AI_ENABLE_PLAYPAGE_ENTRY;
      setAiEnabled(enabled);

      // 加载AI默认消息配置
      const defaultMsg = (window as any).RUNTIME_CONFIG
        ?.AI_DEFAULT_MESSAGE_WITH_VIDEO;
      if (defaultMsg) {
        setAiDefaultMessageWithVideo(defaultMsg);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNetdiskSearchEnabled(
        !!(window as any).RUNTIME_CONFIG?.NETDISK_SEARCH_ENABLED
      );
    }
  }, []);

  // 网页全屏状态 - 控制导航栏的显示隐藏
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  // 原生全屏状态
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  // 监听浏览器原生全屏事件
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setIsNativeFullscreen(isFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange
      );
      document.removeEventListener(
        'mozfullscreenchange',
        handleFullscreenChange
      );
      document.removeEventListener(
        'MSFullscreenChange',
        handleFullscreenChange
      );
    };
  }, []);

  // 组件卸载时停掉链接续期
  useEffect(() => {
    return () => {
      linkRefresherRef.current?.clear();
    };
  }, []);

  // 跳过片头片尾配置
  const [skipConfig, setSkipConfig] = useState<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>({
    enable: false,
    intro_time: 0,
    outro_time: 0,
  });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [
    skipConfig,
    skipConfig.enable,
    skipConfig.intro_time,
    skipConfig.outro_time,
  ]);

  // 快捷快进（P 键和控制栏按钮，默认 90 秒）
  const [quickForwardSeconds, setQuickForwardSeconds] = useState(() =>
    loadStoredSeconds(QUICK_FORWARD_STORAGE_KEY, DEFAULT_QUICK_FORWARD_SECONDS)
  );
  const quickForwardSecondsRef = useRef(quickForwardSeconds);
  useEffect(() => {
    quickForwardSecondsRef.current = quickForwardSeconds;
  }, [quickForwardSeconds]);

  // 左右方向键快进/倒退（默认 10 秒）
  const [seekStepSeconds, setSeekStepSeconds] = useState(() =>
    loadStoredSeconds(SEEK_STEP_STORAGE_KEY, DEFAULT_SEEK_STEP_SECONDS)
  );
  const seekStepSecondsRef = useRef(seekStepSeconds);
  useEffect(() => {
    seekStepSecondsRef.current = seekStepSeconds;
  }, [seekStepSeconds]);

  // 跳过检查的时间间隔控制
  const lastSkipCheckRef = useRef(0);

  // 去广告开关（从 localStorage 继承，默认 true）
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 工具栏去广告开关：用于外部播放器及鸿蒙原生 HLS，默认 false
  const [externalPlayerAdBlock, setExternalPlayerAdBlock] = useState<boolean>(
    () => {
      if (typeof window !== 'undefined') {
        const v = localStorage.getItem('external_player_adblock');
        if (v !== null) return v === 'true';
      }
      return false;
    }
  );
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'external_player_adblock',
        String(externalPlayerAdBlock)
      );
    }
  }, [externalPlayerAdBlock]);

  // Anime4K 超分（内核 Anime4KController：开着时新实例自动重新启动；模式、倍数记在本机）
  const anime4kRef = useRef<Anime4KController | null>(null);
  const anime4k = (anime4kRef.current ??= new Anime4KController());

  // 弹幕（内核 DanmakuController，和房间同一份）：自动匹配、手动选、上传、过滤、数量上限、下一集预加载
  const danmakuRef = useRef<DanmakuController | null>(null);
  const danmaku = (danmakuRef.current ??= new DanmakuController((text) => {
    if (artPlayerRef.current) artPlayerRef.current.notice.show = text;
  }));
  const [danmakuState, setDanmakuState] = useState<DanmakuState>(danmaku.state);
  useEffect(() => {
    setDanmakuState(danmaku.state);
    const unsubscribe = danmaku.subscribe(setDanmakuState);
    return () => {
      unsubscribe();
    };
  }, [danmaku]);
  const [episodeFilterConfig, setEpisodeFilterConfig] =
    useState<EpisodeFilterConfig | null>(null);
  const episodeFilterConfigRef = useRef<EpisodeFilterConfig | null>(null);
  // 弹幕热力图完全禁用开关（默认不禁用，即启用热力图功能）
  const [danmakuHeatmapDisabled, setDanmakuHeatmapDisabled] = useState<boolean>(
    () => {
      if (typeof window !== 'undefined') {
        const v = localStorage.getItem('danmaku_heatmap_disabled');
        if (v !== null) return v === 'true';
      }
      return false; // 默认不禁用
    }
  );
  const danmakuHeatmapDisabledRef = useRef(danmakuHeatmapDisabled);
  useEffect(() => {
    danmakuHeatmapDisabledRef.current = danmakuHeatmapDisabled;
  }, [danmakuHeatmapDisabled]);

  // 弹幕热力图开关（默认开启）
  const [danmakuHeatmapEnabled, setDanmakuHeatmapEnabled] = useState<boolean>(
    () => {
      if (typeof window !== 'undefined') {
        const v = localStorage.getItem('danmaku_heatmap_enabled');
        if (v !== null) return v === 'true';
      }
      return true; // 默认开启
    }
  );
  const danmakuHeatmapEnabledRef = useRef(danmakuHeatmapEnabled);
  useEffect(() => {
    danmakuHeatmapEnabledRef.current = danmakuHeatmapEnabled;
  }, [danmakuHeatmapEnabled]);

  const [showDanmakuFilterSettings, setShowDanmakuFilterSettings] =
    useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const showToast: ShowToast = (message, type) =>
    setToast({ message, type, onClose: () => setToast(null) });
  const [isTranscoding, setIsTranscoding] = useState(false);

  // 初始化弹幕模块（清理过期缓存）
  useEffect(() => {
    initDanmakuModule();
  }, []);

  // 加载弹幕过滤配置
  useEffect(() => {
    const loadFilterConfig = async () => {
      try {
        const config = await getDanmakuFilterConfig();
        danmaku.setFilter(config || { rules: [] });

        // 加载集数过滤配置
        const episodeConfig = await getEpisodeFilterConfig();
        if (episodeConfig) {
          const normalizedEpisodeConfig =
            normalizeEpisodeFilterConfig(episodeConfig);
          setEpisodeFilterConfig(normalizedEpisodeConfig);
          episodeFilterConfigRef.current = normalizedEpisodeConfig;
        } else {
          const defaultEpisodeConfig: EpisodeFilterConfig =
            normalizeEpisodeFilterConfig();
          setEpisodeFilterConfig(defaultEpisodeConfig);
          episodeFilterConfigRef.current = defaultEpisodeConfig;
        }
      } catch (error) {
        console.error('加载过滤配置失败:', error);
      }
    };
    loadFilterConfig();
  }, []);

  // 同步集数过滤配置到ref
  useEffect(() => {
    episodeFilterConfigRef.current = episodeFilterConfig;
  }, [episodeFilterConfig]);

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
  const [pendingNetdiskTMDBData, setPendingNetdiskTMDBData] = useState<
    any | null
  >(null);

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

  // 解析 source 参数以获取 embyKey（仅用于 API 调用）
  const parseSourceForApi = (
    source: string
  ): { source: string; embyKey?: string } => {
    source = normalizeNetdiskSource(source);
    if (source.startsWith('emby_')) {
      const key = source.substring(5);
      return { source: 'emby', embyKey: key };
    }
    return { source };
  };

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
        console.warn('[PlayRecordJump] 移除跳转按钮失败:', err);
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
        console.error('清理预缓存 HLS 实例失败:', e);
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
  useEffect(
    makeLoadDoubanRating({
      isDirectPlay,
      setDoubanAka,
      setDoubanCardSubtitle,
      setDoubanRating,
      setDoubanYear,
      videoDoubanId,
    }),
    [videoDoubanId, isDirectPlay]
  );

  // 获取TMDB背景图
  useEffect(
    makeLoadTmdbBackdrop({
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
    }),
    [videoTitle, videoDoubanId, isDirectPlay]
  );

  // 复用背景请求解析出的 tmdbId，拉取该剧集当前季的分集名称（懒加载，按需触发）
  const loadTmdbEpisodeNames = useCallback(
    async (tmdbIdStr: string, seasonOverride?: number) => {
      try {
        const [mediaType, idPart] = tmdbIdStr.split(':');
        const id = parseInt(idPart, 10);
        if (mediaType !== 'tv' || !id) {
          return;
        }

        // 季度：优先手动指定，否则从标题解析，缺省第 1 季
        let seasonNumber = seasonOverride;
        if (!seasonNumber || seasonNumber < 1) {
          const seasonMatch =
            videoTitle?.match(/第\s*(\d+)\s*[季部]/) ||
            videoTitle?.match(/[Ss]eason\s*(\d+)/) ||
            videoTitle?.match(/\bS(\d+)\b/);
          const parsedSeason = seasonMatch ? parseInt(seasonMatch[1], 10) : NaN;
          seasonNumber =
            Number.isNaN(parsedSeason) || parsedSeason < 1 ? 1 : parsedSeason;
        }

        // 指纹含 id + 季，避免重复拉取；手动改季时可重新拉取
        const fingerprint = `${tmdbIdStr}#s${seasonNumber}`;
        if (tmdbEpisodesFetchedIdRef.current === fingerprint) {
          return;
        }
        tmdbEpisodesFetchedIdRef.current = fingerprint;

        const resp = await fetch(
          `/api/tmdb/episodes?id=${id}&season=${seasonNumber}`
        );
        if (!resp.ok) return;
        const season = await resp.json();
        const eps = season?.episodes;
        if (!Array.isArray(eps) || eps.length === 0) return;

        const names: string[] = [];
        eps.forEach((ep: any) => {
          const num =
            typeof ep?.episode_number === 'number' ? ep.episode_number : NaN;
          if (!Number.isNaN(num) && num >= 1 && ep?.name) {
            names[num - 1] = String(ep.name);
          }
        });
        if (names.some((n) => n && n.trim() !== '')) {
          setTmdbEpisodeNames(names);
        }
      } catch (err) {
        console.error('获取TMDB分集名称失败:', err);
      }
    },
    [videoTitle]
  );

  // 换剧时重置分集名相关状态
  useEffect(() => {
    tmdbEpisodesFetchedIdRef.current = null;
    setTmdbEpisodeNames([]);
  }, [videoTitle]);

  // 总集数
  const totalEpisodes = detail?.episodes?.length || 0;

  // 是否为动漫内容（决定分集名来源优先级：动漫弹幕优先，非动漫 TMDB 优先）
  const isAnimeContent = useMemo(
    () => isAnimeCategoryText(detail?.type_name, detail?.class),
    [detail?.type_name, detail?.class]
  );

  // 分集标题里出现多个季度（SxxExx 中含 ≥2 个不同季号）时，弹幕（按番剧单季编号）无法跨季对齐、不可靠，
  // 此时无论是否动漫都改用 TMDB。
  const hasMultipleSeasons = useMemo(() => {
    const titles = detail?.episodes_titles;
    if (!titles || titles.length === 0) return false;
    const seasons = new Set<number>();
    for (const t of titles) {
      const m = t?.match(/[Ss](\d+)[Ee]\d+/);
      if (m) seasons.add(parseInt(m[1], 10));
      if (seasons.size >= 2) return true;
    }
    return false;
  }, [detail?.episodes_titles]);

  // 分集名是否 TMDB 优先：手动矫正优先（弹幕优先→false / 指定 TMDB→true），
  // 否则默认按类型：非动漫，或虽是动漫但含多个季度（弹幕不可靠）
  const preferTmdbNames = titleCorrection.preferDanmaku
    ? false
    : titleCorrection.tmdbId
    ? true
    : !isAnimeContent || hasMultipleSeasons;

  // 手动指定的 TMDB 剧集串（覆盖自动解析）
  const effectiveTmdbIdStr = titleCorrection.tmdbId
    ? `tv:${titleCorrection.tmdbId}`
    : resolvedTmdbIdStr;

  // 弹幕分集名（按番号对齐视频集，需完整分集列表；由 LRU 缓存或主动搜索提供）。
  // 去掉来源标记与集号后仍有实质内容才返回，否则返回 null（视为不可用）。
  const danmakuRichNames = useMemo<(string | undefined)[] | null>(() => {
    if (totalEpisodes <= 1) return null;
    if (episodeTitleFetchDisabled) return null;
    if (danmakuState.episodes.length === 0) return null;

    const extractEpNum = (title?: string): number | null => {
      if (!title) return null;
      const emby = title.match(/[Ss]\d+[Ee](\d+)/);
      if (emby) return parseInt(emby[1], 10);
      const zh = title.match(/^(\d+)$|第?\s*(\d+)\s*[集话話]?/);
      return zh ? parseInt(zh[1] || zh[2], 10) : null;
    };

    // 番号 -> 弹幕标题，便于按集数对齐；无番号时回退索引对齐
    const byNumber = new Map<number, string>();
    danmakuState.episodes.forEach((ep) => {
      const num = extractEpNum(ep.episodeTitle);
      if (num !== null && !byNumber.has(num)) {
        byNumber.set(num, ep.episodeTitle);
      }
    });

    const names: (string | undefined)[] = [];
    for (let i = 0; i < totalEpisodes; i += 1) {
      const videoNum = extractEpNum(detail?.episodes_titles?.[i]) ?? i + 1;
      const matched = byNumber.get(videoNum);
      const fallback = danmakuState.episodes[i]?.episodeTitle;
      const name = cleanEpisodeDisplayName(matched || fallback);
      names[i] = name || undefined;
    }
    return names.some((n) => n) ? names : null;
  }, [
    totalEpisodes,
    episodeTitleFetchDisabled,
    danmakuState.episodes,
    detail?.episodes_titles,
  ]);

  // 拉取 TMDB 分集名。TMDB 优先（非动漫或多季度动漫）：解析出 tmdbId 后即请求；
  // 弹幕优先（单季动漫）：先等弹幕自动装填「尘埃落定」，且仅在弹幕未产出可用标题时才降级拉 TMDB。
  // 手动「弹幕优先」时完全不搜 TMDB；手动指定 TMDB 时用指定的 id/季。
  useEffect(() => {
    if (isDirectPlay) return;
    if (episodeTitleFetchDisabled) return;
    if (titleCorrection.preferDanmaku) return; // 弹幕优先：不搜 TMDB
    if (!detail) return; // 等类型判定就绪，避免误判非动漫而抢先拉 TMDB
    if (!effectiveTmdbIdStr) return;
    if (!preferTmdbNames) {
      if (danmakuRichNames) return; // 弹幕已够用，无需 TMDB
      if (!danmakuState.settled) return; // 弹幕优先：先等弹幕落定再决定是否降级
    }
    loadTmdbEpisodeNames(effectiveTmdbIdStr, titleCorrection.season);
  }, [
    isDirectPlay,
    episodeTitleFetchDisabled,
    titleCorrection.preferDanmaku,
    titleCorrection.season,
    detail,
    effectiveTmdbIdStr,
    preferTmdbNames,
    danmakuRichNames,
    danmakuState.settled,
    loadTmdbEpisodeNames,
  ]);

  useEffect(() => {
    if (pendingNetdiskTMDBData && isNetdiskSource(detail?.source)) {
      const currentDetail = detail;
      if (!currentDetail) {
        return;
      }
      const pending = pendingNetdiskTMDBData;
      setPendingNetdiskTMDBData(null);
      const tmdbYear = pending.releaseDate?.split('-')[0] || '';
      const shouldReplaceDesc =
        !currentDetail.desc ||
        currentDetail.desc.startsWith('临时播放目录：') ||
        currentDetail.desc.startsWith('移动云盘分享：');
      const resolvedTmdbId =
        typeof pending.tmdbId === 'string'
          ? Number(String(pending.tmdbId).split(':')[1] || 0)
          : pending.tmdbId;

      setNetdiskTMDBMeta({
        desc: shouldReplaceDesc
          ? pending.overview || currentDetail.desc
          : currentDetail.desc,
        poster: currentDetail.poster || pending.poster || '',
        year: currentDetail.year || tmdbYear,
        tmdbId: currentDetail.tmdb_id || resolvedTmdbId,
      });

      setDetail((prev) =>
        prev && isNetdiskSource(prev.source)
          ? {
              ...prev,
              poster: prev.poster || pending.poster || '',
              year: prev.year || tmdbYear,
              desc: shouldReplaceDesc
                ? pending.overview || prev.desc
                : prev.desc,
              tmdb_id: prev.tmdb_id || resolvedTmdbId,
            }
          : prev
      );

      if (pending.poster && !currentDetail.poster) {
        setVideoCover(processImageUrl(pending.poster));
      }
      if (tmdbYear && !currentDetail.year) {
        setVideoYear(tmdbYear);
      }
      if (pending.overview) {
        setCorrectedDesc(pending.overview);
      }
    }
  }, [pendingNetdiskTMDBData, detail]);

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

      try {
        const savedMode = localStorage.getItem(HARMONY_HLS_PLAYBACK_MODE_KEY);
        return savedMode === 'native' ? 'native' : 'hlsjs';
      } catch {
        return 'hlsjs';
      }
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
      try {
        return localStorage.getItem(NETDISK_HLS_PLAYBACK_MODE_KEY) === 'hlsjs'
          ? 'hlsjs'
          : 'native';
      } catch {
        return 'native';
      }
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
    setToast,
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

  // TMDB 分集名。TMDB(zh-CN)对无本地化标题的集数会返回「第 N 集」占位，
  // 与弹幕一样用 cleanEpisodeDisplayName 去集号：整列去号后无实质内容视为无有效名字（null），
  // 避免占位名把选集面板误切到列表视图。
  // 起始集数（startEpisode）：视频第 1 集对应 TMDB 第 startEpisode 集，据此平移取名。
  const tmdbRichNames = useMemo<(string | undefined)[] | null>(() => {
    if (totalEpisodes <= 1) return null;
    if (episodeTitleFetchDisabled) return null;
    const offset = Math.max(1, titleCorrection.startEpisode ?? 1) - 1;
    const names = Array.from({ length: totalEpisodes }, (_, i) => {
      const cleaned = cleanEpisodeDisplayName(tmdbEpisodeNames[offset + i]);
      return cleaned || undefined;
    });
    return names.some((n) => n) ? names : null;
  }, [
    totalEpisodes,
    episodeTitleFetchDisabled,
    tmdbEpisodeNames,
    titleCorrection.startEpisode,
  ]);

  // 选集列表的分集名称。优先级：
  //   单季动漫：弹幕优先（可纠错性高、番剧标题更贴合），降级 TMDB
  //   非动漫 / 多季度动漫：TMDB 优先，降级弹幕
  const richEpisodeNames = useMemo<(string | undefined)[]>(() => {
    const ordered = preferTmdbNames
      ? [tmdbRichNames, danmakuRichNames]
      : [danmakuRichNames, tmdbRichNames];
    for (const names of ordered) {
      if (names) return names;
    }
    return [];
  }, [preferTmdbNames, danmakuRichNames, tmdbRichNames]);
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

  const formatQuickForwardDuration = (seconds: number) => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds
        ? `${minutes}分${remainingSeconds}秒`
        : `${minutes}分钟`;
    }
    return `${seconds}秒`;
  };

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
    player.notice.show = `快进 ${formatQuickForwardDuration(
      quickForwardSecondsRef.current
    )}`;
    return true;
  };

  const isPlaybackThumbnailDisabled = () => {
    if (typeof window === 'undefined') {
      return true;
    }

    const saved = localStorage.getItem('disablePlaybackThumbnail');
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
  const playRecordJumpLayerRef = useRef<any>(null); // 保存跳转按钮层的引用
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
      console.warn('[Play] Failed to prune local episode progress:', error);
    }
  }, []);

  // 优选和测速开关
  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
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
      const saved = localStorage.getItem('preferStrategy');
      if (saved === 'fast' || saved === 'full') {
        return saved;
      }
    }
    return 'fast';
  });

  // 优选偏好：综合判定(balanced) / 分辨率优先(resolution) / 网速优先(speed)
  const [preferMode] = useState<'balanced' | 'resolution' | 'speed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferMode');
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
      const domains: string[] = JSON.parse(
        localStorage.getItem('directplay_proxy_domains') || '[]'
      );
      return domains.includes(domain);
    } catch {
      return false;
    }
  };
  // 将域名记录到代理列表
  const addDirectplayProxyDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      const domains: string[] = JSON.parse(
        localStorage.getItem('directplay_proxy_domains') || '[]'
      );
      if (!domains.includes(domain)) {
        domains.push(domain);
        localStorage.setItem(
          'directplay_proxy_domains',
          JSON.stringify(domains)
        );
      }
    } catch {
      /* ignore */
    }
  };

  // 播放器就绪状态（用于触发 usePlaySync 的事件监听器设置）
  const [playerReady, setPlayerReady] = useState(false);

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const lastSavedPlayTimeRef = useRef<number | null>(null);

  // 下集预缓存相关
  const nextEpisodePreCacheTriggeredRef = useRef<boolean>(false);
  const nextEpisodePreCacheHlsRef = useRef<any>(null);
  const nextEpisodeDanmakuPreloadTriggeredRef = useRef<boolean>(false);

  const artPlayerRef = useRef<any>(null);
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
      setToast({
        message,
        type,
        ...(type === 'info' ? { duration: 5000 } : {}),
        onClose: () => setToast(null),
      }),
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
      playbackSession.reportMedia(null);
      return;
    }
    playbackSession.reportMedia({
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
    playbackSession.reportMedia,
  ]);
  useEffect(
    () => () => playbackSession.reportMedia(null),
    // 卸载时清空：这个播放实例不再在放任何影片
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const watchRoomContext = useWatchRoomContextSafe();
  useEffect(() => {
    if (!playerReady || !artPlayerRef.current) return;
    playbackSession.attachController(artPlayerRef.current);
    return () => playbackSession.attachController(null);
  }, [playerReady, playbackSession.attachController]);
  useEffect(() => {
    playbackSession.setMetadata({
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
    playbackSession.setMetadata,
  ]);
  // 切集后把集数写回播放地址（不重建播放器）。否则地址仍是上一集：
  // 刷新、复制链接、带着当前影片开房间时都会被当成另一部片而重新加载。
  useEffect(() => {
    if (loading || !detail || !currentSource || !currentId) return;
    if (
      detail.source !== currentSource ||
      String(detail.id) !== String(currentId)
    )
      return;
    const current = new URL(
      playbackSession.href || '/play',
      window.location.origin
    );
    if (current.pathname !== '/play') return;
    const episode = String(currentEpisodeIndex + 1);
    if (current.searchParams.get('episode') === episode) return;
    current.searchParams.set('episode', episode);
    commitPlaybackHref(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEpisodeIndex, detail, currentSource, currentId, loading]);

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
      setToast({
        message: '观影室服务未连接',
        type: 'error',
        duration: 3000,
        onClose: () => setToast(null),
      });
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
    } catch (error: any) {
      setToast({
        message: error?.message || '创建观影室失败',
        type: 'error',
        duration: 3000,
        onClose: () => setToast(null),
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
    const urls = (window as any).__localFileBlobUrls;
    if (Array.isArray(urls)) {
      urls.forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    }
    (window as any).__localFileBlobUrls = [];
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

    try {
      localStorage.setItem(HARMONY_HLS_PLAYBACK_MODE_KEY, mode);
    } catch {
      // 隐私模式等场景可能禁用 localStorage，但不应阻止本次切换。
    }
    setHarmonyHlsPlaybackMode(mode);
  };

  const switchNetdiskHlsPlaybackMode = (mode: NetdiskHlsPlaybackMode) => {
    if (mode === netdiskHlsPlaybackMode) return;

    prepareHarmonyHlsReinit();

    try {
      localStorage.setItem(NETDISK_HLS_PLAYBACK_MODE_KEY, mode);
    } catch {
      // 隐私模式等场景可能禁用 localStorage，但不应阻止本次切换。
    }
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
        console.warn('清理播放器资源时出错:', err);
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
    get formatTime() {
      return formatTime;
    },
    get handleSkipConfigChange() {
      return handleSkipConfigChange;
    },
    setSkipConfig,
    skipConfigRef,
  });

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (hours === 0) {
      // 不到一小时，格式为 00:00
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      // 超过一小时，格式为 00:00:00
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex);
  }, [detail, currentEpisodeIndex]);

  // 进入页面时直接获取全部源信息
  useEffect(
    makeLoadSourceDetail({
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
    }),
    []
  );

  // 跳过片头片尾配置处理
  useEffect(() => {
    // 仅在初次挂载时检查跳过片头片尾配置
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;

      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) {
          setSkipConfig(config);
        }
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };

    initSkipConfig();
  }, []);

  // 监听 URL 参数变化，处理换源和换视频（用于房员跟随房主操作）
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
          setCurrentEpisodeIndex(targetEpisode);

          // 如果是同一集,保存播放进度以便恢复
          if (targetEpisode === currentEpisodeIndex && currentPlayTime > 1) {
            resumeTimeRef.current = currentPlayTime;
          } else {
            resumeTimeRef.current = null;
          }
        }
      } else {
        // Recreate the media surface while preserving the room and global navigation.
        playbackSession.reloadPlayback();
      }
    }
  }, [
    searchParams,
    currentSource,
    currentId,
    availableSources,
    currentEpisodeIndex,
  ]);

  // 监听 detail 和 currentEpisodeIndex 变化，自动获取视频信息
  useEffect(() => {
    if (detail && detail.episodes && detail.episodes.length > 0) {
      fetchCurrentSourceVideoInfo();
    }
  }, [detail, currentEpisodeIndex]);

  // 监听 detail 和 currentEpisodeIndex 变化，动态更新字幕
  useEffect(() => {
    if (!artPlayerRef.current || !detail) return;

    subtitles.setTracks(
      (detail.subtitles?.[currentEpisodeIndex] || []) as SourceSubtitle[],
      String(currentEpisodeIndex)
    );
  }, [detail, currentEpisodeIndex]);

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
      console.warn('[Play] Failed to read source-switch play record:', error);
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
      console.warn(
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

  useEffect(() => {
    // 页面即将卸载时保存播放进度和清理资源
    const handleBeforeUnload = () => {
      saveCurrentPlayProgress();
      cleanupPlayer();
    };

    // 页面切到后台时保存播放进度（防息屏由 wakeLockPlugin 管）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentPlayProgress();
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 收藏相关
  // ---------------------------------------------------------------------------
  // 每当 source 或 id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, any>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      }
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        // 如果已收藏，删除收藏
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        // 如果未收藏，添加收藏
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year || 'unknown',
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
          is_completed: seriesStatus(detailRef.current) === 'completed',
          vod_remarks: detailRef.current?.vod_remarks,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  // 纠错成功后的回调
  const handleCorrectSuccess = () => {
    if (!detail || detail.source !== 'xiaoya') return;

    // 从 localStorage 读取纠错信息
    const correction = getXiaoyaCorrection(detail.source, detail.id);
    if (correction) {
      console.log('应用纠错信息:', correction);

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

      console.log('已应用纠错信息');
    }
  };

  useEffect(
    makeLoadPlayer({
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
    }),
    [
      videoUrl,
      loading,
      blockAdEnabled,
      harmonyHlsPlaybackMode,
      nativeHlsAdBlockEnabled,
      netdiskHlsPlaybackMode,
    ]
  );

  // 当组件卸载时清理定时器和播放器资源
  useEffect(() => {
    return () => {
      // 清理定时器
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }

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
          className='fixed inset-0 z-0'
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

      <div className='tm-page-container relative z-[1] flex flex-col gap-3 py-4 tm-solo-page'>
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
        <div className='space-y-2 tm-solo-row'>
          <div
            // 手机 / 平板上和标题之间留 8px（电脑上由 playback.css 归零）
            className={`mt-2 grid gap-4 wide:h-[520px] wide:xl:h-[620px] wide:2xl:h-[680px] transition-all duration-300 ease-in-out ${
              isEpisodeSelectorCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 wide:grid-cols-4'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`transition-all duration-300 ease-in-out rounded-xl border border-line flex flex-col ${
                isEpisodeSelectorCollapsed ? 'col-span-1' : 'wide:col-span-3'
              }`}
            >
              {/* 播放器容器 */}
              <div className='tm-playback-video-frame relative w-full h-[300px] wide:flex-1 wide:min-h-0'>
                <div
                  ref={artRef}
                  data-tm-player-mount
                  className='bg-surface w-full h-full rounded-xl overflow-hidden shadow-lg'
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
      {toast && <Toast {...toast} />}

      <input
        ref={customSubtitleInputRef}
        type='file'
        accept={CUSTOM_SUBTITLE_ACCEPT}
        className='hidden'
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
          setToast({
            message,
            type,
            onClose: () => setToast(null),
          });
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
