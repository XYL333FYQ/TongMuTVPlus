/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

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
import {
  clearDanmakuCacheByTitle,
  convertDanmakuFormat,
  getDanmakuById,
  getDanmakuFromCache,
  getEpisodes,
  initDanmakuModule,
  loadDanmakuDisplayState,
  loadDanmakuSettings,
  saveDanmakuDisplayState,
  saveDanmakuSettings,
  searchAnime,
} from '@/lib/danmaku/api';
import {
  getCachedDanmakuEpisodes,
  setCachedDanmakuEpisodes,
} from '@/lib/danmaku/episodes-cache';
import { cleanEpisodeDisplayName } from '@/lib/danmaku/format';
import {
  getDanmakuAnimeId,
  getDanmakuSearchKeyword,
  getDanmakuSourceIndex,
  getManualDanmakuSelection,
  saveDanmakuAnimeId,
  saveDanmakuSearchKeyword,
  saveDanmakuSourceIndex,
  saveManualDanmakuSelection,
} from '@/lib/danmaku/selection-memory';
import type {
  DanmakuAnime,
  DanmakuComment,
  DanmakuSelection,
  DanmakuSettings,
} from '@/lib/danmaku/types';
import {
  deleteFavorite,
  deleteSkipConfig,
  generateStorageKey,
  getAllPlayRecords,
  getDanmakuFilterConfig,
  getEpisodeFilterConfig,
  getSkipConfig,
  isFavorited,
  migratePlayRecord,
  saveFavorite,
  savePlayRecord,
  saveSkipConfig,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import {
  DEVICE_TIER_EVENT,
  getDeviceTier,
  isHandheld,
} from '@/lib/device-tier';
import { getDoubanDetail } from '@/lib/douban.client';
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
import { getIndexedDBVideoPlaybackUrl } from '@/lib/indexeddb-video-cache';
import { isNetdiskSource, normalizeNetdiskSource } from '@/lib/netdisk/source';
import {
  DEFAULT_QUICK_FORWARD_SECONDS,
  DEFAULT_SEEK_STEP_SECONDS,
  loadStoredSeconds,
  normalizeStoredSeconds,
  QUICK_FORWARD_STORAGE_KEY,
  SEEK_STEP_STORAGE_KEY,
} from '@/lib/player-seek-settings';
import { installTouchControls } from '@/lib/player-touch-controls';
import {
  getRecommendationCache,
  recommendationCacheKeys,
  setRecommendationCache,
} from '@/lib/recommendations/cache';
import {
  appendSpecialSourceParam,
  isSpecialSourceContext,
} from '@/lib/special-source.client';
import { CUSTOM_SUBTITLE_ACCEPT } from '@/lib/subtitle-converter';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { getTranscoderCookieHeader } from '@/lib/transcoder-cookie.client';
import {
  DanmakuFilterConfig,
  EpisodeFilterConfig,
  SearchResult,
} from '@/lib/types';
import {
  base58Decode,
  getVideoResolutionFromM3u8,
  processImageUrl,
} from '@/lib/utils';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { useEnableAIComments } from '@/hooks/useEnableAIComments';
import { useEnableComments } from '@/hooks/useEnableComments';
import {
  parsePlaybackEpisodeIndex,
  usePlaybackEpisode,
} from '@/hooks/usePlaybackEpisode';
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
  Anime4KController,
  bindKeyboard,
  checkWebGPU,
  heatmapPlugin,
  iosOrientationPlugin,
  LinkRefresher,
  playbackRatePlugin,
  playerEnvironment,
  progressThumbPlugin,
  setHeatmapEnabled,
  type SourceSubtitle,
  SubtitleController,
  WatchPlayer,
  wakeLockPlugin,
} from '@/features/player';

import { isHlsPlaybackUrl } from './lib/playback-urls';
import { seriesStatus } from './lib/series-status';
import DanmakuSourceDialog from './page/DanmakuSourceDialog';
import EpisodePanel from './page/EpisodePanel';
import PansouDialog from './page/PansouDialog';
import PlaybackComments from './page/PlaybackComments';
import PlaybackDetail from './page/PlaybackDetail';
import PlaybackDock from './page/PlaybackDock';
import PlaybackDrawers, { usePlaybackDrawers } from './page/PlaybackDrawers';
import PlaybackFailure from './page/PlaybackFailure';
import PlaybackLoading from './page/PlaybackLoading';
import PlaybackRail from './page/PlaybackRail';
import PlaybackTitle from './page/PlaybackTitle';
import PlaybackTools from './page/PlaybackTools';
import ShortcutDialog from './page/ShortcutDialog';
import type {
  FallbackRecommendation,
  PlaybackPanel,
  ShowToast,
} from './page/types';
import VideoOverlays from './page/VideoOverlays';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
  }
}

// Wake Lock API 类型声明
interface WakeLockSentinel {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

interface SearchCachePayload {
  status: 'complete' | 'partial';
  results: SearchResult[];
  query: string;
  updatedAt: number;
}

type PlaybackSourceBadge = 'local' | 'offline' | null;
type HarmonyHlsPlaybackMode = 'hlsjs' | 'native';
type NetdiskHlsPlaybackMode = 'hlsjs' | 'native';

const HARMONY_HLS_PLAYBACK_MODE_KEY = 'harmony_hls_playback_mode';
const NETDISK_HLS_PLAYBACK_MODE_KEY = 'netdisk_hls_playback_mode';
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

  // 弹幕相关状态
  const [danmakuSettings, setDanmakuSettings] = useState<DanmakuSettings>(
    loadDanmakuSettings()
  );
  const [danmakuFilterConfig, setDanmakuFilterConfig] =
    useState<DanmakuFilterConfig | null>(null);
  const danmakuFilterConfigRef = useRef<DanmakuFilterConfig | null>(null);
  const [episodeFilterConfig, setEpisodeFilterConfig] =
    useState<EpisodeFilterConfig | null>(null);
  const episodeFilterConfigRef = useRef<EpisodeFilterConfig | null>(null);
  const [currentDanmakuSelection, setCurrentDanmakuSelection] =
    useState<DanmakuSelection | null>(null);
  const [danmakuEpisodesList, setDanmakuEpisodesList] = useState<
    Array<{ episodeId: number; episodeTitle: string }>
  >([]);
  // 弹幕自动装填是否已「尘埃落定」（搜索完成/无源/已禁用）。
  // 动漫优先用弹幕，需等它落定后再决定是否降级拉取 TMDB 分集名。
  const [danmakuAutoLoadSettled, setDanmakuAutoLoadSettled] = useState(false);
  const [danmakuLoading, setDanmakuLoading] = useState(false);
  const [danmakuCount, setDanmakuCount] = useState(0);
  const [danmakuOriginalCount, setDanmakuOriginalCount] = useState(0);
  const danmakuPluginRef = useRef<any>(null);
  const danmakuSettingsRef = useRef(danmakuSettings);

  // 弹幕显示状态的 ref，初始化时从 localStorage 读取
  const danmakuDisplayStateRef = useRef<boolean>(
    (() => {
      const saved = loadDanmakuDisplayState();
      return saved !== false; // null 或 true 都返回 true
    })()
  );

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

  // 多条弹幕匹配结果
  const [danmakuMatches, setDanmakuMatches] = useState<DanmakuAnime[]>([]);
  const [showDanmakuSourceSelector, setShowDanmakuSourceSelector] =
    useState(false);
  const [showDanmakuFilterSettings, setShowDanmakuFilterSettings] =
    useState(false);
  const [currentSearchKeyword, setCurrentSearchKeyword] = useState<string>(''); // 当前搜索使用的关键词
  const [toast, setToast] = useState<ToastProps | null>(null);
  const showToast: ShowToast = (message, type) =>
    setToast({ message, type, onClose: () => setToast(null) });
  const [isTranscoding, setIsTranscoding] = useState(false);

  useEffect(() => {
    danmakuSettingsRef.current = danmakuSettings;
  }, [danmakuSettings]);

  // 初始化弹幕模块（清理过期缓存）
  useEffect(() => {
    initDanmakuModule();
  }, []);

  // 加载弹幕过滤配置
  useEffect(() => {
    const loadFilterConfig = async () => {
      try {
        const config = await getDanmakuFilterConfig();
        if (config) {
          setDanmakuFilterConfig(config);
          danmakuFilterConfigRef.current = config;
        } else {
          // 如果没有配置，设置默认空配置
          const defaultConfig: DanmakuFilterConfig = { rules: [] };
          setDanmakuFilterConfig(defaultConfig);
          danmakuFilterConfigRef.current = defaultConfig;
        }

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

  // 同步弹幕过滤配置到ref
  useEffect(() => {
    danmakuFilterConfigRef.current = danmakuFilterConfig;
  }, [danmakuFilterConfig]);

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

  // 监听剧集切换，自动加载对应的弹幕
  const lastLoadedEpisodeIndexForDanmakuRef = useRef<number | null>(null);
  const loadingDanmakuEpisodeIdRef = useRef<number | null>(null);
  // 正在进行的弹幕加载（同一集并发去重，避免换集重建播放器时重复搜索导致选择弹窗弹出两次）
  const danmakuLoadInFlightRef = useRef<{
    episodeIndex: number;
    promise: Promise<'done' | 'retry'>;
  } | null>(null);
  // 弹幕自动加载逻辑的最新引用（由下方 effect 赋值，供播放器插件就绪后重入同一流程）
  const danmakuEpisodeLoaderRef = useRef<
    ((episodeIndex: number) => Promise<'done' | 'retry'>) | null
  >(null);

  // 统一写入弹幕完整分集列表：更新 state，并按视频标题做 LRU 缓存，供下次进入复用
  const applyDanmakuEpisodes = useCallback(
    (episodes: Array<{ episodeId: number; episodeTitle: string }>) => {
      setDanmakuEpisodesList(episodes);
      setCachedDanmakuEpisodes(videoTitleRef.current, episodes);
    },
    []
  );

  // 自动加载指定集数弹幕的统一入口（剧集切换与播放器插件就绪共用，内部去重）
  // 返回 'done' 表示该集已处理（含已弹出选择弹窗）；'retry' 表示因弹幕插件未就绪等原因放弃，待插件就绪后可重新触发
  const loadDanmakuForEpisode = async (
    episodeIndex: number,
    retryCount = 0
  ): Promise<'done' | 'retry'> => {
    if (isDirectPlay) return 'done';

    // 检查是否禁用了自动加载弹幕
    if (isDanmakuAutoLoadDisabled()) {
      console.log('[弹幕] 已禁用自动加载弹幕，跳过自动加载');
      setShowDanmakuSourceSelector(false);
      setDanmakuLoading(false);
      // 已禁用自动装填：弹幕不会自动到来，视为落定，允许动漫降级到 TMDB
      setDanmakuAutoLoadSettled(true);
      return 'done';
    }

    if (episodeIndex == null || episodeIndex < 0) {
      return 'done';
    }

    // 如果该集已处理完毕，跳过
    if (lastLoadedEpisodeIndexForDanmakuRef.current === episodeIndex) {
      return 'done';
    }

    // 同一集已有加载在进行中：等待其结果，避免并发重复搜索（选择弹窗弹出两次的根源）
    const inFlight = danmakuLoadInFlightRef.current;
    if (inFlight && inFlight.episodeIndex === episodeIndex) {
      const result = await inFlight.promise;
      // 此前因弹幕插件未就绪而放弃，而本调用发生在插件就绪之后，重试一次
      if (result === 'retry' && danmakuPluginRef.current && retryCount < 2) {
        return loadDanmakuForEpisode(episodeIndex, retryCount + 1);
      }
      return result;
    }

    const loader = danmakuEpisodeLoaderRef.current;
    if (!loader) {
      return 'done';
    }

    const run = loader(episodeIndex);
    danmakuLoadInFlightRef.current = { episodeIndex, promise: run };
    const result = await run;
    if (danmakuLoadInFlightRef.current?.promise === run) {
      danmakuLoadInFlightRef.current = null;
    }
    if (result === 'done') {
      // 标记该集已处理完毕
      lastLoadedEpisodeIndexForDanmakuRef.current = episodeIndex;
      // 弹幕自动装填流程已完成（含无源/已弹出选择器），标记落定
      setDanmakuAutoLoadSettled(true);
      return 'done';
    }
    // 'retry'：因弹幕插件未就绪而放弃；若此刻插件已就绪（本调用来自插件就绪回调等场景），重试一次
    if (danmakuPluginRef.current && retryCount < 2) {
      return loadDanmakuForEpisode(episodeIndex, retryCount + 1);
    }
    return result;
  };

  useEffect(() => {
    // 等待初始化完成（播放记录恢复完成）
    if (loading) {
      return;
    }

    if (isDirectPlay) {
      return;
    }

    // 检查集数是否有效
    if (currentEpisodeIndex < 0 || !videoTitle) {
      return;
    }

    console.log(
      `[弹幕] 剧集切换到第 ${currentEpisodeIndex + 1} 集，自动加载弹幕`
    );

    // 自动加载弹幕的逻辑（挂到 ref 上，供播放器插件就绪后通过 loadDanmakuForEpisode 重入）
    const loadDanmakuForCurrentEpisode = async (
      episodeIndex: number
    ): Promise<'done' | 'retry'> => {
      const title = videoTitleRef.current;
      if (!title) {
        console.warn('[弹幕] 视频标题为空，无法加载弹幕');
        return 'retry';
      }

      console.log(`[弹幕] 开始加载第 ${episodeIndex + 1} 集弹幕`);

      // 立即清空当前弹幕（使用 reset 方法，不触发显示/隐藏事件）
      if (danmakuPluginRef.current) {
        danmakuPluginRef.current.reset();
        // reset() 不会清空 option.danmuku，这里显式清空，
        // 避免换集后下一集无弹幕/加载失败时热力图残留上一集数据
        danmakuPluginRef.current.config({ danmuku: [] });
        danmakuPluginRef.current.load();
        setDanmakuCount(0);
        // 通知热力图立即擦除上一集曲线
        if (artPlayerRef.current) {
          artPlayerRef.current.emit('danmaku:loaded');
        }
      }

      // 先尝试从 IndexedDB 缓存加载
      try {
        const cachedData = await getDanmakuFromCache(title, episodeIndex);
        if (cachedData && cachedData.comments.length > 0) {
          console.log(
            `[弹幕] 使用缓存: title="${title}", episodeIndex=${episodeIndex}, 数量=${cachedData.comments.length}`
          );

          // 如果弹幕插件还未初始化，放弃并等待插件就绪后重新触发
          if (!danmakuPluginRef.current) {
            console.log('[弹幕] 弹幕插件未初始化，等待插件就绪后重新加载');
            return 'retry';
          }

          setDanmakuLoading(true);

          // 转换弹幕格式
          let danmakuData = convertDanmakuFormat(cachedData.comments);

          // 手动应用过滤规则
          const filterConfig = danmakuFilterConfigRef.current;
          if (filterConfig && filterConfig.rules.length > 0) {
            const originalCount = danmakuData.length;
            danmakuData = danmakuData.filter((danmu) => {
              for (const rule of filterConfig.rules) {
                if (!rule.enabled) continue;
                try {
                  if (rule.type === 'normal') {
                    if (danmu.text.includes(rule.keyword)) {
                      return false;
                    }
                  } else if (rule.type === 'regex') {
                    if (new RegExp(rule.keyword).test(danmu.text)) {
                      return false;
                    }
                  }
                } catch (e) {
                  console.error('弹幕过滤规则错误:', e);
                }
              }
              return true;
            });
            const filteredCount = originalCount - danmakuData.length;
            if (filteredCount > 0) {
              console.log(
                `弹幕过滤: 原始 ${originalCount} 条，过滤 ${filteredCount} 条，剩余 ${danmakuData.length} 条`
              );
            }
          }

          // 应用弹幕数量限制
          const maxCount =
            typeof window !== 'undefined'
              ? parseInt(localStorage.getItem('danmakuMaxCount') || '5000', 10)
              : 0;
          let calculatedOriginalCount = 0;
          if (maxCount > 0 && danmakuData.length > maxCount) {
            const originalCount = danmakuData.length;
            const step = danmakuData.length / maxCount;
            const limitedData = [];
            for (let i = 0; i < maxCount; i++) {
              limitedData.push(danmakuData[Math.floor(i * step)]);
            }
            danmakuData = limitedData;
            calculatedOriginalCount = originalCount;
            setDanmakuOriginalCount(originalCount);
            console.log(
              `弹幕数量限制: 原始 ${originalCount} 条，限制到 ${danmakuData.length} 条`
            );
          } else {
            // 没有应用限制，不显示原始数量
            setDanmakuOriginalCount(0);
          }

          // 加载弹幕到插件
          const currentSettings = danmakuSettingsRef.current;
          danmakuPluginRef.current.config({
            danmuku: danmakuData,
            speed: currentSettings.speed,
            opacity: currentSettings.opacity,
            fontSize: currentSettings.fontSize,
            margin: [currentSettings.marginTop, currentSettings.marginBottom],
            synchronousPlayback: currentSettings.synchronousPlayback,
          });
          danmakuPluginRef.current.load();

          // 触发自定义事件通知热力图更新
          if (artPlayerRef.current) {
            artPlayerRef.current.emit('danmaku:loaded');
          }

          // 根据保存的显示状态来决定显示或隐藏弹幕
          const savedDisplayState = loadDanmakuDisplayState();
          if (savedDisplayState === false) {
            danmakuPluginRef.current.hide();
          } else {
            danmakuPluginRef.current.show();
          }

          setDanmakuCount(danmakuData.length);
          console.log(`[弹幕] 缓存加载成功，共 ${danmakuData.length} 条`);

          // 更新当前选择状态（使用实时计算的数量）
          if (cachedData.metadata) {
            setCurrentDanmakuSelection({
              animeId: cachedData.metadata.animeId || 0,
              episodeId: cachedData.metadata.episodeId || 0,
              animeTitle: cachedData.metadata.animeTitle || '',
              episodeTitle: cachedData.metadata.episodeTitle || '',
              searchKeyword: cachedData.metadata.searchKeyword,
              danmakuCount: danmakuData.length,
              danmakuOriginalCount:
                calculatedOriginalCount > 0
                  ? calculatedOriginalCount
                  : undefined,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 1500));
          setDanmakuLoading(false);

          return 'done'; // 使用缓存成功，直接返回
        }
      } catch (error) {
        console.error('[弹幕] 读取缓存失败:', error);
      }

      // 没有缓存，先检查是否有手动选择的剧集 ID
      console.log(`[弹幕] 第 ${episodeIndex + 1} 集缓存未命中`);

      // 检查是否有手动选择的剧集 ID
      const manualEpisodeId = getManualDanmakuSelection(title, episodeIndex);
      if (manualEpisodeId) {
        console.log(`[弹幕记忆] 使用手动选择的剧集 ID: ${manualEpisodeId}`);
        if (!danmakuPluginRef.current) {
          console.log('[弹幕] 弹幕插件未初始化，等待插件就绪后重新加载');
          return 'retry';
        }
        try {
          // 需要获取完整的 selection 信息来调用 handleDanmakuSelect
          // 但这里只有 episodeId，所以保持直接调用 loadDanmaku
          setDanmakuLoading(true);
          await loadDanmaku(manualEpisodeId);
          console.log('[弹幕记忆] 使用手动选择的弹幕成功');
          return 'done'; // 使用手动选择成功，直接返回
        } catch (error) {
          console.error('[弹幕记忆] 使用手动选择的弹幕失败:', error);
          // 继续执行自动搜索
        }
      }

      // 尝试使用保存的动漫ID自动匹配剧集
      const savedAnimeId = getDanmakuAnimeId(title);
      if (savedAnimeId) {
        console.log(`[弹幕记忆] 尝试使用保存的动漫ID: ${savedAnimeId}`);
        if (!danmakuPluginRef.current) {
          console.log('[弹幕] 弹幕插件未初始化，等待插件就绪后重新加载');
          return 'retry';
        }
        setDanmakuLoading(true);
        try {
          const episodesResult = await getEpisodes(savedAnimeId);

          if (
            episodesResult.success &&
            episodesResult.bangumi.episodes.length > 0
          ) {
            // 根据当前集数选择对应的弹幕
            const videoEpTitle =
              detailRef.current?.episodes_titles?.[episodeIndex];
            const episode = matchDanmakuEpisode(
              episodeIndex,
              episodesResult.bangumi.episodes,
              videoEpTitle
            );

            if (episode) {
              console.log(
                `[弹幕记忆] 使用保存的动漫ID匹配成功: ${episode.episodeTitle}`
              );

              const selection: DanmakuSelection = {
                animeId: savedAnimeId,
                episodeId: episode.episodeId,
                animeTitle: episodesResult.bangumi.animeTitle,
                episodeTitle: episode.episodeTitle,
              };

              applyDanmakuEpisodes(episodesResult.bangumi.episodes);

              // 通过统一的 handleDanmakuSelect 处理弹幕加载
              await handleDanmakuSelect(selection);
              return 'done'; // 匹配成功，直接返回
            } else {
              console.log(
                '[弹幕记忆] 使用保存的动漫ID匹配失败，降级到关键词搜索'
              );
            }
          }
        } catch (error) {
          console.error('[弹幕记忆] 使用保存的动漫ID失败:', error);
        }
      }

      // 执行自动搜索弹幕（优先使用保存的关键词）
      console.log(`[弹幕] 开始自动搜索`);
      setDanmakuLoading(true);

      // 优先使用保存的搜索关键词，否则使用视频标题
      const savedKeyword = getDanmakuSearchKeyword(title);
      const searchKeyword = savedKeyword || title;
      console.log(
        `[弹幕] 搜索关键词: ${searchKeyword}${
          savedKeyword ? ' (使用保存的关键词)' : ' (使用视频标题)'
        }`
      );

      try {
        const searchResult = await searchAnime(searchKeyword);

        if (searchResult.success && searchResult.animes.length > 0) {
          // 应用智能过滤：优先匹配年份和标题
          const videoYear = detailRef.current?.year;
          const filteredAnimes = filterDanmakuSources(
            searchResult.animes,
            title,
            videoYear
          );

          // 如果有多个匹配结果，先检查是否有记忆的选择
          if (filteredAnimes.length > 1) {
            console.log(`找到 ${filteredAnimes.length} 个弹幕源`);

            // 检查是否有上次选择的下标
            const rememberedIndex = getDanmakuSourceIndex(title);
            if (
              rememberedIndex !== null &&
              rememberedIndex < filteredAnimes.length
            ) {
              console.log(
                `[弹幕记忆] 使用上次选择的弹幕源，下标: ${rememberedIndex}`
              );
              const anime = filteredAnimes[rememberedIndex];

              // 获取剧集列表
              const episodesResult = await getEpisodes(anime.animeId);

              if (
                episodesResult.success &&
                episodesResult.bangumi.episodes.length > 0
              ) {
                // 根据当前集数选择对应的弹幕
                const videoEpTitle =
                  detailRef.current?.episodes_titles?.[episodeIndex];
                const episode = matchDanmakuEpisode(
                  episodeIndex,
                  episodesResult.bangumi.episodes,
                  videoEpTitle
                );

                if (episode) {
                  const selection: DanmakuSelection = {
                    animeId: anime.animeId,
                    episodeId: episode.episodeId,
                    animeTitle: anime.animeTitle,
                    episodeTitle: episode.episodeTitle,
                  };

                  // 设置剧集列表
                  applyDanmakuEpisodes(episodesResult.bangumi.episodes);

                  console.log('使用记忆的弹幕源成功:', selection);

                  // 通过统一的 handleDanmakuSelect 处理弹幕加载
                  await handleDanmakuSelect(selection);
                  setDanmakuLoading(false);
                  return 'done';
                }
              }
            }

            // 没有记忆或记忆失效，让用户选择
            console.log(`等待用户选择弹幕源`);
            setDanmakuMatches(filteredAnimes);
            setCurrentSearchKeyword(searchKeyword); // 保存当前搜索关键词
            setShowDanmakuSourceSelector(true);
            setDanmakuLoading(false);
            if (artPlayerRef.current) {
              artPlayerRef.current.notice.show = `找到 ${filteredAnimes.length} 个弹幕源，请选择`;
            }
            return 'done';
          }

          // 只有一个结果，直接使用
          if (!danmakuPluginRef.current) {
            console.log('[弹幕] 弹幕插件未初始化，等待插件就绪后重新加载');
            setDanmakuLoading(false);
            return 'retry';
          }

          const anime = filteredAnimes[0];

          // 获取剧集列表
          const episodesResult = await getEpisodes(anime.animeId);

          if (
            episodesResult.success &&
            episodesResult.bangumi.episodes.length > 0
          ) {
            // 根据当前集数选择对应的弹幕
            const videoEpTitle =
              detailRef.current?.episodes_titles?.[episodeIndex];
            const episode = matchDanmakuEpisode(
              episodeIndex,
              episodesResult.bangumi.episodes,
              videoEpTitle
            );

            if (episode) {
              const selection: DanmakuSelection = {
                animeId: anime.animeId,
                episodeId: episode.episodeId,
                animeTitle: anime.animeTitle,
                episodeTitle: episode.episodeTitle,
              };

              // 设置剧集列表
              applyDanmakuEpisodes(episodesResult.bangumi.episodes);

              console.log('自动搜索弹幕成功:', selection);

              // 通过统一的 handleDanmakuSelect 处理弹幕加载
              await handleDanmakuSelect(selection);
            }
          } else {
            console.warn('未找到剧集信息');
            if (artPlayerRef.current) {
              artPlayerRef.current.notice.show = '弹幕加载失败：未找到剧集信息';
            }
          }
        } else {
          console.warn('未找到匹配的弹幕');
          if (artPlayerRef.current) {
            artPlayerRef.current.notice.show =
              '未找到匹配的弹幕，可在弹幕选项卡手动搜索';
          }
        }
      } catch (error) {
        console.error('自动搜索弹幕失败:', error);
        if (artPlayerRef.current) {
          artPlayerRef.current.notice.show =
            '弹幕加载失败，请检查网络或稍后重试';
        }
      } finally {
        setDanmakuLoading(false);
      }

      return 'done';
    };

    danmakuEpisodeLoaderRef.current = loadDanmakuForCurrentEpisode;

    loadDanmakuForEpisode(currentEpisodeIndex);
  }, [currentEpisodeIndex, videoTitle, loading, isDirectPlay]);

  // 获取豆瓣评分数据
  useEffect(() => {
    const fetchDoubanRating = async () => {
      if (isDirectPlay) {
        setDoubanRating(null);
        setDoubanCardSubtitle('');
        setDoubanAka([]);
        setDoubanYear('');
        return;
      }

      if (!videoDoubanId || videoDoubanId === 0) {
        setDoubanRating(null);
        setDoubanCardSubtitle('');
        setDoubanAka([]);
        setDoubanYear('');
        return;
      }

      try {
        const doubanData = await getDoubanDetail(videoDoubanId.toString());

        // 设置评分
        if (doubanData.rating) {
          setDoubanRating({
            value: doubanData.rating.value,
            count: doubanData.rating.count,
            star_count: doubanData.rating.star_count,
          });
        } else {
          setDoubanRating(null);
        }

        // 设置 card_subtitle
        if (doubanData.card_subtitle) {
          setDoubanCardSubtitle(doubanData.card_subtitle);
        }

        // 设置 aka（别名）
        if (doubanData.aka && doubanData.aka.length > 0) {
          setDoubanAka(doubanData.aka);
        }

        // 处理 pubdate 获取年份
        if (doubanData.pubdate && doubanData.pubdate.length > 0) {
          const pubdateStr = doubanData.pubdate[0];
          // 删除括号中的内容，包括括号
          const yearMatch = pubdateStr.replace(/\([^)]*\)/g, '').trim();
          if (yearMatch) {
            setDoubanYear(yearMatch);
          }
        }
      } catch (error) {
        console.error('获取豆瓣评分失败:', error);
        setDoubanRating(null);
        setDoubanCardSubtitle('');
        setDoubanAka([]);
        setDoubanYear('');
      }
    };

    fetchDoubanRating();
  }, [videoDoubanId, isDirectPlay]);

  // 获取TMDB背景图
  useEffect(() => {
    const fetchTMDBBackdrop = async () => {
      if (isDirectPlay) {
        setTmdbBackdrop(null);
        setTmdbEpisodeNames([]);
        setResolvedTmdbIdStr(null);
        return;
      }

      // 检查是否禁用背景图
      if (typeof window !== 'undefined') {
        const disabled = localStorage.getItem('tmdb_backdrop_disabled');
        if (disabled === 'true') {
          setTmdbBackdrop(null);
          return;
        }
      }

      if (!videoTitle) {
        setTmdbBackdrop(null);
        setTmdbEpisodeNames([]);
        setResolvedTmdbIdStr(null);
        return;
      }

      try {
        const mappingCacheKey =
          recommendationCacheKeys.tmdbTitleMapping(videoTitle);
        const cachedId = getRecommendationCache<string>(mappingCacheKey);

        if (cachedId) {
          console.log('使用缓存的TMDB ID映射');
          // 记录 tmdbId，交由懒加载按需拉取分集名称（弹幕优先，降级 TMDB）
          setResolvedTmdbIdStr(cachedId);

          const detailsCacheKey = recommendationCacheKeys.tmdbDetails(cachedId);
          const detailsCache = getRecommendationCache<any>(detailsCacheKey);

          if (detailsCache) {
            if (detailsCache.backdrop) {
              setTmdbBackdrop(processImageUrl(detailsCache.backdrop));
            } else {
              setTmdbBackdrop(null);
            }

            if (!videoDoubanId || videoDoubanId === 0) {
              populateDoubanFieldsFromTMDB(detailsCache);
            }
            populatePlayMetadataFromTMDB(detailsCache);
            return;
          }
        }

        // 构建请求URL
        const url = cachedId
          ? `/api/tmdb-details?cachedId=${encodeURIComponent(cachedId)}`
          : `/api/tmdb-details?title=${encodeURIComponent(videoTitle)}`;

        const response = await fetch(url);

        if (!response.ok) {
          setTmdbBackdrop(null);
          return;
        }

        const result = await response.json();

        if (result.backdrop) {
          setTmdbBackdrop(processImageUrl(result.backdrop));
        } else {
          setTmdbBackdrop(null);
        }

        // 如果没有豆瓣ID，使用TMDb数据补充
        if (!videoDoubanId || videoDoubanId === 0) {
          populateDoubanFieldsFromTMDB(result);
        }
        populatePlayMetadataFromTMDB(result);

        // 保存title到tmdbId的映射到localStorage（1个月）
        if (result.tmdbId) {
          // 记录 tmdbId，交由懒加载按需拉取分集名称
          setResolvedTmdbIdStr(String(result.tmdbId));
          try {
            setRecommendationCache(mappingCacheKey, String(result.tmdbId));

            const detailsCacheKey = recommendationCacheKeys.tmdbDetails(
              result.tmdbId
            );
            setRecommendationCache(detailsCacheKey, result);
          } catch (e) {
            console.error('保存缓存失败:', e);
          }
        }
      } catch (error) {
        console.error('获取TMDB背景图失败:', error);
        setTmdbBackdrop(null);
      }
    };

    const populatePlayMetadataFromTMDB = (tmdbData: any) => {
      const currentDetail = detailRef.current;
      if (!currentDetail || !isNetdiskSource(currentDetail.source)) {
        setPendingNetdiskTMDBData(tmdbData);
        return;
      }

      const tmdbYear = tmdbData.releaseDate?.split('-')[0] || '';
      const shouldReplaceDesc =
        !currentDetail.desc ||
        currentDetail.desc.startsWith('临时播放目录：') ||
        currentDetail.desc.startsWith('移动云盘分享：');

      const resolvedTmdbId =
        typeof tmdbData.tmdbId === 'string'
          ? Number(String(tmdbData.tmdbId).split(':')[1] || 0)
          : tmdbData.tmdbId;

      setNetdiskTMDBMeta({
        desc: shouldReplaceDesc
          ? tmdbData.overview || currentDetail.desc
          : currentDetail.desc,
        poster: currentDetail.poster || tmdbData.poster || '',
        year: currentDetail.year || tmdbYear,
        tmdbId: currentDetail.tmdb_id || resolvedTmdbId,
      });

      setDetail((prev) => {
        if (!prev || !isNetdiskSource(prev.source)) {
          return prev;
        }

        return {
          ...prev,
          poster: prev.poster || tmdbData.poster || '',
          year: prev.year || tmdbYear,
          desc: shouldReplaceDesc ? tmdbData.overview || prev.desc : prev.desc,
          tmdb_id: prev.tmdb_id || resolvedTmdbId,
        };
      });

      if (
        tmdbData.overview &&
        (!correctedDesc || currentDetail.desc?.startsWith('临时播放目录：'))
      ) {
        setCorrectedDesc(tmdbData.overview);
      }

      if (tmdbData.poster && !currentDetail.poster) {
        setVideoCover(processImageUrl(tmdbData.poster));
      }

      if (tmdbYear && !currentDetail.year) {
        setVideoYear(tmdbYear);
      }
    };

    // 辅助函数：使用TMDb数据填充豆瓣字段
    const populateDoubanFieldsFromTMDB = (tmdbData: any) => {
      // 设置评分
      if (tmdbData.rating) {
        const ratingValue = parseFloat(tmdbData.rating);
        setDoubanRating({
          value: ratingValue,
          count: 0, // TMDb不提供评分人数
          star_count: Math.round(ratingValue / 2), // 转换为5星制
        });
      }

      // 设置年份
      if (tmdbData.releaseDate) {
        const year = tmdbData.releaseDate.split('-')[0];
        setDoubanYear(year);
      }

      // 设置card_subtitle（优先使用genres标签，否则使用年份和类型）
      if (
        tmdbData.genres &&
        Array.isArray(tmdbData.genres) &&
        tmdbData.genres.length > 0
      ) {
        const genreNames = tmdbData.genres.map((g: any) => g.name).join(' / ');
        setDoubanCardSubtitle(genreNames);
      } else if (tmdbData.mediaType && tmdbData.releaseDate) {
        // 兜底：如果没有genres，使用年份和类型
        const year = tmdbData.releaseDate.split('-')[0];
        const typeText = tmdbData.mediaType === 'movie' ? '电影' : '电视剧';
        setDoubanCardSubtitle(`${year} / ${typeText}`);
      }
    };

    fetchTMDBBackdrop();
  }, [videoTitle, videoDoubanId, isDirectPlay]);

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
    setDanmakuAutoLoadSettled(false);
  }, [videoTitle]);

  // 换剧时用弹幕完整分集列表缓存（LRU）预填 danmakuEpisodesList，
  // 使命中缓存时无需重新搜索即可展示列表视图；无缓存则清空。
  useEffect(() => {
    if (episodeTitleFetchDisabled) {
      setDanmakuEpisodesList([]);
      return;
    }
    const cached = getCachedDanmakuEpisodes(videoTitle);
    setDanmakuEpisodesList(cached ?? []);
  }, [videoTitle, episodeTitleFetchDisabled]);

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
    if (danmakuEpisodesList.length === 0) return null;

    const extractEpNum = (title?: string): number | null => {
      if (!title) return null;
      const emby = title.match(/[Ss]\d+[Ee](\d+)/);
      if (emby) return parseInt(emby[1], 10);
      const zh = title.match(/^(\d+)$|第?\s*(\d+)\s*[集话話]?/);
      return zh ? parseInt(zh[1] || zh[2], 10) : null;
    };

    // 番号 -> 弹幕标题，便于按集数对齐；无番号时回退索引对齐
    const byNumber = new Map<number, string>();
    danmakuEpisodesList.forEach((ep) => {
      const num = extractEpNum(ep.episodeTitle);
      if (num !== null && !byNumber.has(num)) {
        byNumber.set(num, ep.episodeTitle);
      }
    });

    const names: (string | undefined)[] = [];
    for (let i = 0; i < totalEpisodes; i += 1) {
      const videoNum = extractEpNum(detail?.episodes_titles?.[i]) ?? i + 1;
      const matched = byNumber.get(videoNum);
      const fallback = danmakuEpisodesList[i]?.episodeTitle;
      const name = cleanEpisodeDisplayName(matched || fallback);
      names[i] = name || undefined;
    }
    return names.some((n) => n) ? names : null;
  }, [
    totalEpisodes,
    episodeTitleFetchDisabled,
    danmakuEpisodesList,
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
      if (!danmakuAutoLoadSettled) return; // 弹幕优先：先等弹幕落定再决定是否降级
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
    danmakuAutoLoadSettled,
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

  const handleCreateTranscodeSession = async () => {
    if (isTranscoding) return;

    try {
      setIsTranscoding(true);
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;

      const sourceUrl = await resolveCurrentExternalPlaybackUrl();
      if (!sourceUrl) {
        throw new Error('当前没有可转码的播放链接');
      }

      const requestHeaders: Record<string, string> = {};
      if (sourceUrl.startsWith(window.location.origin)) {
        // 登录凭证脚本读不到了，向本站要一份短效副本交给转码程序
        const cookie = await getTranscoderCookieHeader();
        if (cookie) {
          requestHeaders.Cookie = cookie;
        }
        requestHeaders.Referer = `${window.location.origin}/`;
      }

      let response: Response;
      try {
        response = await fetch(`${LOCAL_TRANSCODER_BASE_URL}/v1/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: sourceUrl,
            headers:
              Object.keys(requestHeaders).length > 0
                ? requestHeaders
                : undefined,
            subtitle: {
              mode: 'burn_embedded',
              stream: 'auto',
            },
            refresh: false,
          }),
        });
      } catch {
        throw new Error('转码服务连接失败');
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || `转码请求失败 (${response.status})`
        );
      }

      const playUrl = data?.playlist_url || data?.play_url;
      if (!playUrl) {
        throw new Error('转码器未返回播放地址');
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));

      linkRefresher.clear();
      proxyAttemptedRef.current = false;
      resumeTimeRef.current = currentPlayTime > 0 ? currentPlayTime : null;
      setVideoQualities([]);
      setVideoError(null);
      setCorsFailedUrl(null);
      setIsVideoLoading(true);
      setVideoLoadingStage('sourceChanging');
      setPlaybackSourceBadge(null);
      setVideoUrl(playUrl);
      setToast({
        message: '转码任务已创建，等待 3 秒后已切换到转码地址',
        type: 'success',
        onClose: () => setToast(null),
      });
    } catch (error) {
      console.error('创建转码任务失败:', error);
      setToast({
        message: error instanceof Error ? error.message : '创建转码任务失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setIsTranscoding(false);
    }
  };

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

  const isDanmakuAutoLoadDisabled = () => {
    if (typeof window === 'undefined') {
      return false;
    }

    const saved = localStorage.getItem('disableAutoLoadDanmaku');
    if (saved !== null) {
      return saved === 'true';
    }

    return (window as any).RUNTIME_CONFIG?.DANMAKU_AUTO_LOAD_DEFAULT === false;
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
  const fetchCurrentSourceVideoInfo = async () => {
    if (!detail || !detail.episodes || detail.episodes.length === 0) {
      return;
    }

    // 获取当前集数的播放地址
    let episodeUrl = detail.episodes[currentEpisodeIndex];
    if (!episodeUrl) {
      return;
    }

    // openlist 的 lazy 播放地址或已确认的单文件直链（如 mkv），解析前无法探测分辨率（内部 hls.js XHR 还会触发 CORS 误报），跳过
    if (
      episodeUrl.startsWith('/api/openlist/play') ||
      videoMediaTypeRef.current === 'file'
    ) {
      setCurrentSourceVideoInfo(null);
      return;
    }

    // 简单的正则或者后缀判断，如果明确不是 m3u8 (比如 mp4)，则不走 m3u8 代理
    const isM3u8 =
      episodeUrl.toLowerCase().includes('.m3u') ||
      !episodeUrl.toLowerCase().match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);

    if (currentSource === 'directplay' && isM3u8) {
      // 仅当 localStorage 记忆了该域名需要代理时才走代理
      if (isDirectplayDomainProxied(episodeUrl)) {
        episodeUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
          episodeUrl
        )}&source=directplay`;
      } else {
        // 直链模式且未走代理：跳过 HLS.js 探测。
        // getVideoResolutionFromM3u8 内部使用 HLS.js (XMLHttpRequest) 加载，
        // 而 XHR 受 CORS 限制，探测必然失败。实际播放器通过 <video src> 加载不受 CORS 影响。
        console.log(
          '[视频信息] 直链直连模式，跳过分辨率探测（避免 CORS 误报）'
        );
        setCurrentSourceVideoInfo(null);
        return;
      }
    } else if (sourceProxyMode && isM3u8) {
      episodeUrl = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
        episodeUrl
      )}&source=${encodeURIComponent(currentSource)}`;
    }

    try {
      const info = await getVideoResolutionFromM3u8(episodeUrl, 4000);
      setCurrentSourceVideoInfo(info);
    } catch (error) {
      console.error('获取视频信息失败:', error);
      setCurrentSourceVideoInfo(null);
    }
  };

  // 播放源优选函数
  const preferBestSource = async (
    sources: SearchResult[]
  ): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    type SourceTestResult = {
      source: SearchResult;
      testResult: {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        bitrate: string;
      };
    };
    type MaybeSourceTestResult = SourceTestResult | null;

    const sortedByWeight = [...sources].sort((a, b) => {
      const weightA = a.weight ?? 0;
      const weightB = b.weight ?? 0;
      return weightB - weightA;
    });

    const finalizeSelection = (
      completedResults: MaybeSourceTestResult[]
    ): SearchResult => {
      const newVideoInfoMap = new Map<
        string,
        {
          quality: string;
          loadSpeed: string;
          pingTime: number;
          bitrate: string;
        }
      >();
      completedResults.forEach((result) => {
        if (!result) return;
        const sourceKey = `${result.source.source}-${result.source.id}`;
        newVideoInfoMap.set(sourceKey, result.testResult);
      });
      setPrecomputedVideoInfo(newVideoInfoMap);

      const successfulResults = completedResults.filter(
        Boolean
      ) as SourceTestResult[];

      if (successfulResults.length === 0) {
        console.warn('所有播放源测速都失败，按权重排序');
        return sortedByWeight[0];
      }

      const validSpeeds = successfulResults
        .map((result) => {
          const speedStr = result.testResult.loadSpeed;
          if (speedStr === '未知' || speedStr === '测量中...') return 0;

          const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
          if (!match) return 0;

          const value = parseFloat(match[1]);
          const unit = match[2];
          return unit === 'MB/s' ? value * 1024 : value;
        })
        .filter((speed) => speed > 0);

      const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;

      const validPings = successfulResults
        .map((result) => result.testResult.pingTime)
        .filter((ping) => ping > 0);

      const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
      const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

      const resultsWithScore = successfulResults.map((result) => ({
        ...result,
        score: calculateSourceScore(
          result.testResult,
          maxSpeed,
          minPing,
          maxPing,
          result.source.weight ?? 0
        ),
      }));

      resultsWithScore.sort((a, b) => b.score - a.score);

      console.log('播放源评分排序结果:');
      resultsWithScore.forEach((result, index) => {
        console.log(
          `${index + 1}. ${
            result.source.source_name
          } - 评分: ${result.score.toFixed(2)} (${result.testResult.quality}, ${
            result.testResult.loadSpeed
          }, ${result.testResult.pingTime}ms)`
        );
      });

      return resultsWithScore[0].source;
    };

    const testSingleSource = async (
      source: SearchResult
    ): Promise<MaybeSourceTestResult> => {
      try {
        if (!source.episodes || source.episodes.length === 0) {
          console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
          return null;
        }

        let episodeUrl =
          source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];

        const isM3u8 =
          episodeUrl.toLowerCase().includes('.m3u') ||
          !episodeUrl
            .toLowerCase()
            .match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);
        if (source.source === 'directplay' && isM3u8) {
          if (isDirectplayDomainProxied(episodeUrl)) {
            episodeUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
              episodeUrl
            )}&source=directplay`;
          }
        } else if (source.proxyMode && isM3u8) {
          episodeUrl = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
            episodeUrl
          )}&source=${encodeURIComponent(source.source)}`;
        }

        const testResult = await getVideoResolutionFromM3u8(episodeUrl);

        return {
          source,
          testResult,
        };
      } catch (error) {
        return null;
      }
    };

    const maxConcurrency = Math.ceil(sources.length / 2);

    const runAllWithSameConcurrency = async (): Promise<
      MaybeSourceTestResult[]
    > => {
      const results: MaybeSourceTestResult[] = new Array(sources.length);
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < sources.length) {
          const currentIndex = nextIndex++;
          results[currentIndex] = await testSingleSource(sources[currentIndex]);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, sources.length) }, () =>
          worker()
        )
      );

      return results;
    };

    if (preferStrategy === 'full' || sortedByWeight.length < 5) {
      const allResults = await runAllWithSameConcurrency();
      return finalizeSelection(allResults);
    }

    const topPriorityKeys = new Set(
      sortedByWeight
        .slice(0, 5)
        .map((source) => `${source.source}-${source.id}`)
    );

    const quickResults = await new Promise<MaybeSourceTestResult[]>(
      (resolve) => {
        const results: Array<MaybeSourceTestResult | undefined> = new Array(
          sources.length
        );
        let nextIndex = 0;
        let activeCount = 0;
        let completedCount = 0;
        let topCompletedCount = 0;
        let topSuccessCount = 0;
        let settled = false;

        const maybeResolve = () => {
          if (settled) return;

          if (topCompletedCount === 5 && topSuccessCount > 0) {
            settled = true;
            resolve(
              results.filter(
                (result) => result !== undefined
              ) as MaybeSourceTestResult[]
            );
            return;
          }

          if (completedCount === sources.length) {
            settled = true;
            resolve(results as MaybeSourceTestResult[]);
            return;
          }

          while (
            !settled &&
            activeCount < maxConcurrency &&
            nextIndex < sources.length
          ) {
            const currentIndex = nextIndex++;
            const currentSource = sources[currentIndex];
            const sourceKey = `${currentSource.source}-${currentSource.id}`;
            activeCount += 1;

            testSingleSource(currentSource)
              .then((result) => {
                results[currentIndex] = result;
                completedCount += 1;

                if (topPriorityKeys.has(sourceKey)) {
                  topCompletedCount += 1;
                  if (result) {
                    topSuccessCount += 1;
                  }
                }
              })
              .finally(() => {
                activeCount -= 1;
                maybeResolve();
              });
          }
        };

        maybeResolve();
      }
    );

    return finalizeSelection(quickResults);
  };

  // 计算播放源综合评分
  const calculateSourceScore = (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number,
    weight = 0
  ): number => {
    let score = 0;

    // 根据优选偏好确定各维度权重（三项相加恒为 1，保证基础分维持 0-100 量级，
    // 权重加分的相对影响在不同偏好下保持一致）
    const dimensionWeights = (() => {
      switch (preferMode) {
        case 'resolution': // 分辨率优先
          return { quality: 0.6, speed: 0.25, ping: 0.15 };
        case 'speed': // 网速优先（下载速度 + 延迟）
          return { quality: 0.15, speed: 0.55, ping: 0.3 };
        default: // balanced 综合判定（当前模式）
          return { quality: 0.4, speed: 0.4, ping: 0.2 };
      }
    })();

    // 分辨率评分
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * dimensionWeights.quality;

    // 下载速度评分 - 基于最大速度线性映射
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * dimensionWeights.speed;

    // 网络延迟评分 - 基于延迟范围线性映射
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0; // 无效延迟给默认分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) return 100;

      // 线性映射：最低延迟=100分，最高延迟=0分
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * dimensionWeights.ping;

    // 权重加分 - 直接加到总分上（0-100分）
    score += weight;

    return Math.round(score * 100) / 100; // 保留两位小数
  };

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
  const checkLocalDownload = async (
    source: string,
    videoId: string,
    episodeIndex: number
  ): Promise<boolean> => {
    if (!enableOfflineDownload || !hasOfflinePermission) {
      return false;
    }

    try {
      const response = await fetch(
        `/api/offline-download?action=check&source=${encodeURIComponent(
          source
        )}&videoId=${encodeURIComponent(videoId)}&episodeIndex=${episodeIndex}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.downloaded || false;
      }
    } catch (error) {
      console.error('检查本地下载失败:', error);
    }

    return false;
  };

  /**
   * 检查 File System API 本地下载
   */
  const checkFileSystemDownload = async (
    title: string,
    source?: string,
    videoId?: string,
    episodeIndex?: number
  ): Promise<{ hasLocal: boolean; dirHandle?: FileSystemDirectoryHandle }> => {
    try {
      // 从 IndexedDB 读取目录句柄
      const dbName = 'MoonTVPlus';
      const storeName = 'dirHandles';

      return new Promise((resolve) => {
        const request = indexedDB.open(dbName, 2); // 使用版本 2

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 创建 dirHandles 表（如果不存在）
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }

          // 创建 activeTasks 表（如果不存在）
          if (!db.objectStoreNames.contains('activeTasks')) {
            const activeStore = db.createObjectStore('activeTasks', {
              keyPath: 'id',
            });
            activeStore.createIndex('status', 'status', { unique: false });
            activeStore.createIndex('createdAt', 'createdAt', {
              unique: false,
            });
          }

          // 创建 completedTasks 表（如果不存在）
          if (!db.objectStoreNames.contains('completedTasks')) {
            const completedStore = db.createObjectStore('completedTasks', {
              keyPath: 'id',
            });
            completedStore.createIndex('source', 'source', { unique: false });
            completedStore.createIndex('videoId', 'videoId', { unique: false });
            completedStore.createIndex('completedAt', 'completedAt', {
              unique: false,
            });
            completedStore.createIndex('sourceVideoId', ['source', 'videoId'], {
              unique: false,
            });
          }
        };

        request.onsuccess = async (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 检查 object store 是否存在
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve({ hasLocal: false });
            return;
          }

          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const getRequest = store.get('downloadDir');

          getRequest.onsuccess = async () => {
            const dirHandle = getRequest.result as
              | FileSystemDirectoryHandle
              | undefined;
            if (!dirHandle) {
              resolve({ hasLocal: false });
              return;
            }

            try {
              // 请求读权限
              const permission = await (dirHandle as any).queryPermission({
                mode: 'read',
              });
              if (permission !== 'granted') {
                const requestPermission = await (
                  dirHandle as any
                ).requestPermission({ mode: 'read' });
                if (requestPermission !== 'granted') {
                  console.warn('未获得读权限');
                  resolve({ hasLocal: false });
                  return;
                }
              }

              // 如果有 source、videoId 和 episodeIndex，检查子目录
              if (source && videoId && episodeIndex !== undefined) {
                const sourceDirHandle = await dirHandle.getDirectoryHandle(
                  source,
                  { create: false }
                );
                const videoIdDirHandle =
                  await sourceDirHandle.getDirectoryHandle(videoId, {
                    create: false,
                  });
                const epDirHandle = await videoIdDirHandle.getDirectoryHandle(
                  `ep${episodeIndex + 1}`,
                  { create: false }
                );

                // 检查是否存在 playlist.m3u8 文件
                await epDirHandle.getFileHandle('playlist.m3u8', {
                  create: false,
                });
                console.log(
                  '找到本地下载文件:',
                  title,
                  `(${source}/${videoId}/ep${episodeIndex + 1})`
                );
                resolve({ hasLocal: true, dirHandle: epDirHandle });
              } else {
                // 缺少必要参数
                resolve({ hasLocal: false });
              }
            } catch (error) {
              // 文件不存在
              console.error('检查本地文件失败:', error);
              resolve({ hasLocal: false });
            }
          };

          getRequest.onerror = () => {
            resolve({ hasLocal: false });
          };
        };

        request.onerror = () => {
          resolve({ hasLocal: false });
        };
      });
    } catch (error) {
      console.error('检查 File System API 下载失败:', error);
      return { hasLocal: false };
    }
  };

  // 更新视频地址
  const updateVideoUrl = async (
    detailData: SearchResult | null,
    episodeIndex: number
  ) => {
    // 换地址：停掉上一个链接的续期
    linkRefresher.clear();

    // 动态设置 referrer policy：不发送 Referer
    const existingMeta = document.querySelector('meta[name="referrer"]');
    if (!existingMeta) {
      const meta = document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'no-referrer';
      document.head.appendChild(meta);
    }

    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      // 这类源统一先走详情懒加载，如果 episodes 为空则跳过
      if (
        isLazyDetailSource(detailData?.source) &&
        (!detailData?.episodes || detailData.episodes.length === 0)
      ) {
        setPlaybackSourceBadge(null);
        return;
      }
      setPlaybackSourceBadge(null);
      setVideoUrl('');
      return;
    }

    const requestKey = `${detailData.source}|${detailData.id}|${episodeIndex}`;
    const isEpisodeSwitchRequest =
      lastVideoRequestKeyRef.current !== requestKey;
    lastVideoRequestKeyRef.current = requestKey;
    const requestSeq = ++videoUrlRequestSeqRef.current;
    videoMediaTypeRef.current = '';

    let newUrl = detailData?.episodes[episodeIndex] || '';
    let nextPlaybackSourceBadge: PlaybackSourceBadge = null;
    const isXiaoyaLazyPlayUrl = newUrl.startsWith('/api/xiaoya/play');

    if (isEpisodeSwitchRequest && isXiaoyaLazyPlayUrl) {
      setVideoLoadingStage('episodeChanging');
      setIsVideoLoading(true);
      setVideoError(null);
      setCorsFailedUrl(null);

      if (artPlayerRef.current?.video) {
        try {
          const video = artPlayerRef.current.video as HTMLVideoElement;
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (error) {
          console.warn('切集时清空旧视频源失败:', error);
        }
      }

      if (videoUrl) {
        setVideoUrl('');
      }
    }

    // 如果是小雅或 openlist 接口，先请求获取真实 URL
    const isSpecialLazyPlayUrl =
      isXiaoyaLazyPlayUrl ||
      newUrl.startsWith('/api/openlist/play') ||
      newUrl.startsWith('/api/netdisk/115/play') ||
      newUrl.startsWith('/api/netdisk/123/play') ||
      newUrl.startsWith('/api/netdisk/quark/play') ||
      newUrl.startsWith('/api/netdisk/uc/play') ||
      newUrl.startsWith('/api/netdisk/baidu/play') ||
      newUrl.startsWith('/api/source-script/play');

    if (isSpecialLazyPlayUrl) {
      try {
        // 保存原始 lazy URL（用于后续刷新）
        // xiaoya：始终可刷新；openlist：先保存，再以 play 响应的 refresh14m 最终裁定
        const originalLazyUrl = newUrl;
        let refreshableUrl =
          originalLazyUrl.startsWith('/api/xiaoya/play') ||
          originalLazyUrl.startsWith('/api/openlist/play')
            ? originalLazyUrl
            : '';

        // 添加 format=json 参数
        const separator = newUrl.includes('?') ? '&' : '?';
        const fetchUrl = `${newUrl}${separator}format=json`;

        const response = await fetch(fetchUrl);
        const data = await response.json();
        if (requestSeq !== videoUrlRequestSeqRef.current) {
          return;
        }
        if (data.url) {
          newUrl = data.url;
          // 记录服务端探测出的媒体类型（openlist: hls/file），供单文件直连分流
          if (originalLazyUrl.startsWith('/api/openlist/play')) {
            videoMediaTypeRef.current =
              data.mediaType === 'hls' || data.mediaType === 'file'
                ? data.mediaType
                : '';
          }
          // play 响应可带回 refresh14m，覆盖 detail（配置热更新后仍一致）
          if (originalLazyUrl.startsWith('/api/openlist/play')) {
            const refresh14m =
              typeof data.refresh14m === 'boolean'
                ? data.refresh14m
                : Boolean(detailData?.refresh14m);
            if (detailData) {
              detailData.refresh14m = refresh14m;
            }
            if (detailRef.current?.source === 'openlist') {
              detailRef.current.refresh14m = refresh14m;
            }
            // 未开启续期时清空，避免误启定时器
            refreshableUrl = refresh14m ? originalLazyUrl : '';
          }
          // 保存清晰度列表
          if (data.qualities && data.qualities.length > 0) {
            setVideoQualities(data.qualities);
          } else {
            setVideoQualities([]);
          }

          // 拿到真实播放地址后立刻启动 14 分钟续期
          // xiaoya：仅 m3u8；openlist：refresh14m 即可（签名链常无扩展名）
          linkRefresher.setLink(refreshableUrl, true, newUrl);
          linkRefresher.start();
        }
      } catch (error) {
        if (requestSeq !== videoUrlRequestSeqRef.current) {
          return;
        }
        console.error('获取播放链接失败:', error);
        setVideoQualities([]);
      }
    } else {
      // 非小雅/openlist 源，清空清晰度列表
      setVideoQualities([]);
    }

    // 检查是否有 File System API 本地下载的文件
    const episodeTitle =
      detailData?.episodes_titles?.[episodeIndex] || `第${episodeIndex + 1}集`;
    const fileSystemCheck = await checkFileSystemDownload(
      episodeTitle,
      currentSource || undefined,
      currentId || undefined,
      episodeIndex
    );
    if (requestSeq !== videoUrlRequestSeqRef.current) {
      return;
    }

    if (fileSystemCheck.hasLocal && fileSystemCheck.dirHandle) {
      // 使用本地文件播放
      try {
        cleanupLocalPlaybackBlobUrls();
        // 读取 m3u8 文件
        const fileHandle = await fileSystemCheck.dirHandle.getFileHandle(
          'playlist.m3u8',
          { create: false }
        );
        const file = await fileHandle.getFile();
        const content = await file.text();

        // 解析 m3u8 文件，为每个 ts 文件创建 Blob URL
        const lines = content.split('\n');
        const modifiedLines: string[] = [];
        const blobUrls: string[] = []; // 保存 Blob URL 以便后续清理

        for (const line of lines) {
          const trimmedLine = line.trim();

          // 如果是 ts 文件
          if (trimmedLine.endsWith('.ts')) {
            try {
              // 读取 ts 文件
              const tsFileHandle =
                await fileSystemCheck.dirHandle.getFileHandle(trimmedLine, {
                  create: false,
                });
              const tsFile = await tsFileHandle.getFile();

              // 创建 Blob URL
              const blobUrl = URL.createObjectURL(tsFile);
              blobUrls.push(blobUrl);

              // 替换为 Blob URL
              modifiedLines.push(line.replace(trimmedLine, blobUrl));
            } catch (error) {
              console.error(`读取 ts 文件失败: ${trimmedLine}`, error);
              modifiedLines.push(line);
            }
          }
          // 如果是加密密钥
          else if (trimmedLine.includes('key.key')) {
            try {
              const keyFileHandle =
                await fileSystemCheck.dirHandle.getFileHandle('key.key', {
                  create: false,
                });
              const keyFile = await keyFileHandle.getFile();
              const keyBlobUrl = URL.createObjectURL(keyFile);
              blobUrls.push(keyBlobUrl);
              modifiedLines.push(line.replace('key.key', keyBlobUrl));
            } catch (error) {
              console.error('读取密钥文件失败:', error);
              modifiedLines.push(line);
            }
          } else {
            modifiedLines.push(line);
          }
        }

        // 创建修改后的 m3u8 的 Blob URL
        const modifiedContent = modifiedLines.join('\n');
        const m3u8Blob = new Blob([modifiedContent], {
          type: 'application/vnd.apple.mpegurl',
        });
        newUrl = URL.createObjectURL(m3u8Blob);
        nextPlaybackSourceBadge = 'local';

        // 保存 Blob URLs 到 window，以便在切换视频时清理
        (window as any).__localFileBlobUrls = blobUrls;

        console.log(
          '使用 File System API 本地文件播放（Blob URL 模式）:',
          episodeTitle
        );
      } catch (error) {
        console.error('读取本地文件失败:', error);
      }
    }

    let indexedDBCheck: Awaited<
      ReturnType<typeof getIndexedDBVideoPlaybackUrl>
    > = { hasLocal: false };

    // 如果没有 File System API 本地文件，检查 IndexedDB 应用内离线缓存
    if (!fileSystemCheck.hasLocal && currentSource && currentId) {
      indexedDBCheck = await getIndexedDBVideoPlaybackUrl(
        currentSource,
        currentId,
        episodeIndex,
        { preferServiceWorker: true }
      );
      if (requestSeq !== videoUrlRequestSeqRef.current) {
        indexedDBCheck.objectUrls?.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      if (indexedDBCheck.hasLocal && indexedDBCheck.url) {
        cleanupLocalPlaybackBlobUrls();
        if (indexedDBCheck.objectUrls?.length) {
          (window as any).__localFileBlobUrls = indexedDBCheck.objectUrls;
        }
        newUrl = indexedDBCheck.url;
        nextPlaybackSourceBadge = 'local';
        console.log(
          `使用 IndexedDB 本地缓存播放（${
            indexedDBCheck.mode === 'service-worker'
              ? 'Service Worker'
              : 'Blob 降级'
          } 模式）:`,
          episodeTitle
        );
      }
    }

    // 如果没有 File System API / IndexedDB 本地文件，检查服务器端本地下载
    if (!fileSystemCheck.hasLocal && !indexedDBCheck.hasLocal) {
      const hasLocalFile = await checkLocalDownload(
        currentSource,
        currentId,
        episodeIndex
      );
      if (requestSeq !== videoUrlRequestSeqRef.current) {
        return;
      }

      if (hasLocalFile) {
        // 使用本地代理接口,URL以.m3u8结尾以便Artplayer自动识别
        newUrl = `/api/offline-download/local/${currentSource}/${currentId}/${episodeIndex}/playlist.m3u8`;
        nextPlaybackSourceBadge = 'offline';
        console.log('使用服务器端本地下载文件播放:', newUrl);
      } else {
        const isM3u8 =
          newUrl.toLowerCase().includes('.m3u') ||
          !newUrl.toLowerCase().match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);

        if (sourceProxyMode && newUrl && isM3u8) {
          // 如果视频源启用了代理模式,且不是本地下载,则通过代理播放
          newUrl = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
            newUrl
          )}&source=${encodeURIComponent(currentSource)}`;
          console.log('使用代理模式播放:', newUrl);
        } else if (currentSource === 'directplay' && newUrl && isM3u8) {
          // 直链播放模式：检查 localStorage 是否记录了该域名需要代理
          if (isDirectplayDomainProxied(newUrl)) {
            newUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
              newUrl
            )}&source=directplay`;
            console.log('直链播放（域名已记忆）使用代理模式:', newUrl);
          } else {
            console.log('直链播放默认直连模式，不使用代理:', newUrl);
          }
        } else if (!isM3u8) {
          console.log('非 m3u8 格式，豁免代理框架，直接播放原始URL:', newUrl);
        }
      }
    }

    if (isEpisodeSwitchRequest || newUrl !== videoUrl) {
      if (requestSeq !== videoUrlRequestSeqRef.current) {
        return;
      }
      setVideoUrl(newUrl);
    }
    setPlaybackSourceBadge(nextPlaybackSourceBadge);
  };

  // 处理下载指定集数（支持批量下载）
  const handleDownloadEpisode = async (
    episodeIndexes: number[],
    offlineMode = false
  ) => {
    if (!detail || !detail.episodes || episodeIndexes.length === 0) {
      if (artPlayerRef.current) {
        artPlayerRef.current.notice.show = '无法获取视频地址';
      }
      return;
    }
    const origin = `${window.location.protocol}//${window.location.host}`;

    let successCount = 0;
    let failCount = 0;

    // 批量处理下载
    for (const episodeIndex of episodeIndexes) {
      if (episodeIndex >= detail.episodes.length) {
        failCount++;
        continue;
      }

      const episodeUrl = detail.episodes[episodeIndex];

      // 离线下载模式：无论是否开启去广告，都走非去广告逻辑
      const proxyUrl = offlineMode
        ? episodeUrl // 离线下载不使用代理，直接使用原始URL
        : externalPlayerAdBlock
        ? `${origin}/api/proxy-m3u8?url=${encodeURIComponent(
            episodeUrl
          )}&source=${encodeURIComponent(currentSource)}`
        : episodeUrl;

      const isM3u8 =
        episodeUrl.toLowerCase().includes('.m3u8') ||
        episodeUrl.toLowerCase().includes('/m3u8/');

      if (offlineMode && isM3u8) {
        // 离线下载模式 - 调用服务器API
        try {
          const downloadTitle = `${videoTitle}_第${episodeIndex + 1}集`;
          const response = await fetch('/api/offline-download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source: currentSource,
              videoId: currentId,
              episodeIndex,
              title: downloadTitle,
              m3u8Url: proxyUrl,
              metadata: detail
                ? {
                    videoTitle: detail.title,
                    cover: detail.poster,
                    description: detail.desc,
                    year: detail.year,
                    rating: undefined, // SearchResult 没有 rating 字段
                    totalEpisodes: detail.episodes?.length,
                  }
                : undefined,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            successCount++;
          } else {
            console.error(
              `离线下载任务创建失败 (第${episodeIndex + 1}集):`,
              data.error
            );
            failCount++;
          }
        } catch (error) {
          console.error(
            `离线下载任务创建失败 (第${episodeIndex + 1}集):`,
            error
          );
          failCount++;
        }
      } else if (isM3u8) {
        // M3U8格式 - 使用新的下载器，TS 格式
        try {
          const downloadTitle = `${videoTitle}_第${episodeIndex + 1}集`;
          await addDownloadTask(proxyUrl, downloadTitle, 'TS', {
            source: currentSource || undefined,
            videoId: currentId || undefined,
            episodeIndex,
          });
          successCount++;
        } catch (error) {
          console.error(`添加下载任务失败 (第${episodeIndex + 1}集):`, error);
          failCount++;
        }
      } else {
        // 普通视频格式 - 直接下载
        try {
          const a = document.createElement('a');
          a.href = proxyUrl;
          a.download = `${videoTitle}_第${episodeIndex + 1}集.mp4`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          successCount++;
          // 添加延迟避免浏览器阻止多个下载
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`下载失败 (第${episodeIndex + 1}集):`, error);
          failCount++;
        }
      }
    }

    // 显示结果通知
    if (artPlayerRef.current) {
      if (failCount === 0) {
        artPlayerRef.current.notice.show = offlineMode
          ? `已创建 ${successCount} 个离线下载任务！`
          : `已添加 ${successCount} 个下载任务！`;
      } else if (successCount === 0) {
        artPlayerRef.current.notice.show = '下载失败，请重试';
      } else {
        artPlayerRef.current.notice.show = `成功 ${successCount} 个，失败 ${failCount} 个`;
      }
    }
  };

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

  // 播放器实例销毁前（内核换实例、页面卸载时调用）：保存弹幕设置（超分、字幕、续期各自管）
  const releasePlayerResources = () => {
    if (surfaceActiveRef.current) setPlayerReady(false);

    if (artPlayerRef.current) {
      try {
        // 在销毁前先移除弹幕显示/隐藏事件监听器，避免 destroy 时触发 hide 事件导致状态被错误保存
        if (artPlayerRef.current) {
          artPlayerRef.current.off('artplayerPluginDanmuku:show');
          artPlayerRef.current.off('artplayerPluginDanmuku:hide');
        }

        // 在销毁前从弹幕插件读取最新配置并保存
        if (danmakuPluginRef.current?.option && artPlayerRef.current.storage) {
          // 获取当前弹幕设置的快照，避免循环引用
          const currentDanmakuSettings = danmakuSettingsRef.current;
          const danmakuPluginOption = danmakuPluginRef.current.option;

          const currentSettings = {
            ...currentDanmakuSettings,
            opacity:
              danmakuPluginOption.opacity || currentDanmakuSettings.opacity,
            fontSize:
              danmakuPluginOption.fontSize || currentDanmakuSettings.fontSize,
            speed: danmakuPluginOption.speed || currentDanmakuSettings.speed,
            marginTop:
              (danmakuPluginOption.margin && danmakuPluginOption.margin[0]) ??
              currentDanmakuSettings.marginTop,
            marginBottom:
              (danmakuPluginOption.margin && danmakuPluginOption.margin[1]) ??
              currentDanmakuSettings.marginBottom,
          };

          // 保存到 localStorage 和 art.storage
          saveDanmakuSettings(currentSettings);
          artPlayerRef.current.storage.set('danmaku_settings', currentSettings);

          console.log('播放器销毁前保存弹幕设置:', currentSettings);
        }

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
  const handleSkipConfigChange = async (newConfig: {
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }) => {
    if (!currentSourceRef.current || !currentIdRef.current) return;

    try {
      setSkipConfig(newConfig);
      if (!newConfig.enable && !newConfig.intro_time && !newConfig.outro_time) {
        await deleteSkipConfig(currentSourceRef.current, currentIdRef.current);

        // 安全地更新播放器设置，仅在播放器存在时执行
        if (artPlayerRef.current && artPlayerRef.current.setting) {
          try {
            artPlayerRef.current.setting.update({
              name: '跳过片头片尾',
              html: '跳过片头片尾',
              switch: skipConfigRef.current.enable,
              onSwitch: function (item: any) {
                const newConfig = {
                  ...skipConfigRef.current,
                  enable: !item.switch,
                };
                handleSkipConfigChange(newConfig);
                return !item.switch;
              },
            });
            artPlayerRef.current.setting.update({
              name: '跳过配置',
              html: '跳过配置',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="currentColor"/><path d="M9 12L15 12" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
              tooltip:
                skipConfigRef.current.intro_time === 0 &&
                skipConfigRef.current.outro_time === 0
                  ? '设置跳过配置'
                  : `片头: ${formatTime(
                      skipConfigRef.current.intro_time
                    )} | 片尾: ${formatTime(
                      Math.abs(skipConfigRef.current.outro_time)
                    )}`,
            });
          } catch (settingErr) {
            console.warn('更新播放器设置失败:', settingErr);
          }
        }
      } else {
        await saveSkipConfig(
          currentSourceRef.current,
          currentIdRef.current,
          newConfig
        );
      }
      console.log('跳过片头片尾配置已保存:', newConfig);
    } catch (err) {
      console.error('保存跳过片头片尾配置失败:', err);
    }
  };

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
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string,
      title: string,
      fileNameParam?: string
    ): Promise<SearchResult[]> => {
      try {
        let url = appendSpecialSourceParam(
          `/api/source-detail?source=${source}&id=${id}&title=${encodeURIComponent(
            title
          )}`
        );
        // 如果有fileName参数（小雅源），添加到URL
        if (fileNameParam) {
          url += `&fileName=${encodeURIComponent(fileNameParam)}`;
        }
        const detailResponse = await fetch(url);
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        const sourcesWithCorrections = applyCorrectionsToSources([detailData]);
        setAvailableSources(sourcesWithCorrections);
        return sourcesWithCorrections;
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    // 规范化标题用于聚合（去除特殊符号、括号、空格和全角空格）
    const normalizeTitle = (title: string) => {
      return title
        .replace(/[\s\u3000]/g, '') // 去除空格和全角空格
        .replace(/[()（）[\]【】{}「」『』<>《》]/g, '') // 去除各种括号
        .replace(/[^\w\u4e00-\u9fa5]/g, ''); // 去除特殊符号，保留字母、数字、下划线和中文
    };

    // 辅助函数：获取视频类型
    const getType = (item: SearchResult): 'movie' | 'tv' => {
      // 1. Emby 和 OpenList 源：使用 type_name（基于 TMDB，最可靠）
      if (
        item.source === 'emby' ||
        item.source?.startsWith('emby_') ||
        item.source === 'openlist'
      ) {
        return item.type_name === '电影' ? 'movie' : 'tv';
      }

      // 2. API 采集源：综合判断
      const typeName = item.type_name?.toLowerCase() || '';

      // 2.1 明确包含"电影"或"movie"或"片"的，判断为电影
      if (
        typeName.includes('电影') ||
        typeName.includes('movie') ||
        (typeName.endsWith('片') && !typeName.includes('动漫'))
      ) {
        return 'movie';
      }

      // 2.2 包含"剧"、"动漫"、"综艺"等关键词的，判断为剧集
      if (
        typeName.includes('剧') ||
        typeName.includes('动漫') ||
        typeName.includes('综艺') ||
        typeName.includes('anime')
      ) {
        return 'tv';
      }

      // 2.3 检查 episodes_titles：如果包含"第X集"，判断为剧集
      if (item.episodes_titles && item.episodes_titles.length > 0) {
        const firstTitle = item.episodes_titles[0] || '';
        if (/第\d+集|第\d+话|EP?\d+/i.test(firstTitle)) {
          return 'tv';
        }
      }

      // 2.4 兜底：使用 episodes.length（最不可靠）
      return item.episodes.length === 1 ? 'movie' : 'tv';
    };

    const buildFallbackRecommendations = (
      items: SearchResult[],
      query: string
    ): FallbackRecommendation[] => {
      const typedItems = searchType
        ? items.filter((item) => getType(item) === searchType)
        : items;
      const preliminaryMap = new Map<string, SearchResult[]>();

      typedItems.forEach((item) => {
        const preliminaryKey = `${normalizeTitle(
          item.title
        ).toLowerCase()}-${getType(item)}`;
        const group = preliminaryMap.get(preliminaryKey) || [];
        group.push(item);
        preliminaryMap.set(preliminaryKey, group);
      });

      const finalRecommendations: FallbackRecommendation[] = [];

      preliminaryMap.forEach((group, preliminaryKey) => {
        const withYear = new Map<string, SearchResult[]>();
        const withoutYear: SearchResult[] = [];

        group.forEach((item) => {
          if (
            item.year &&
            item.year.trim() !== '' &&
            item.year !== 'unknown' &&
            /^\d{4}$/.test(item.year)
          ) {
            const yearGroup = withYear.get(item.year) || [];
            yearGroup.push(item);
            withYear.set(item.year, yearGroup);
          } else {
            withoutYear.push(item);
          }
        });

        const emitGroup = (groupKey: string, mergedGroup: SearchResult[]) => {
          const sourceNames = Array.from(
            new Set(mergedGroup.map((item) => item.source_name).filter(Boolean))
          );
          const episodeCountMap = new Map<number, number>();
          const doubanCountMap = new Map<number, number>();

          mergedGroup.forEach((item) => {
            const episodeCount = item.episodes?.length || 0;
            if (episodeCount > 0) {
              episodeCountMap.set(
                episodeCount,
                (episodeCountMap.get(episodeCount) || 0) + 1
              );
            }
            if (item.douban_id && item.douban_id > 0) {
              doubanCountMap.set(
                item.douban_id,
                (doubanCountMap.get(item.douban_id) || 0) + 1
              );
            }
          });

          let episodes = 0;
          let episodeVotes = 0;
          episodeCountMap.forEach((votes, count) => {
            if (votes > episodeVotes) {
              episodeVotes = votes;
              episodes = count;
            }
          });

          let doubanId: number | undefined;
          let doubanVotes = 0;
          doubanCountMap.forEach((votes, id) => {
            if (votes > doubanVotes) {
              doubanVotes = votes;
              doubanId = id;
            }
          });

          const representative = mergedGroup.slice().sort((a, b) => {
            const aPoster = a.poster ? 1 : 0;
            const bPoster = b.poster ? 1 : 0;
            if (bPoster !== aPoster) return bPoster - aPoster;
            return (b.weight ?? 0) - (a.weight ?? 0);
          })[0];

          finalRecommendations.push({
            key: groupKey,
            item: representative,
            episodes: episodes || undefined,
            sourceNames,
            doubanId,
          });
        };

        if (withYear.size > 0) {
          withYear.forEach((yearGroup, year) => {
            emitGroup(`${preliminaryKey}-${year}`, [
              ...yearGroup,
              ...withoutYear,
            ]);
          });
        } else if (withoutYear.length > 0) {
          emitGroup(`${preliminaryKey}-unknown`, withoutYear);
        }
      });

      const normalizedQuery = normalizeTitle(query).toLowerCase();

      return finalRecommendations
        .sort((a, b) => {
          const aContains = normalizeTitle(a.item.title)
            .toLowerCase()
            .includes(normalizedQuery)
            ? 1
            : 0;
          const bContains = normalizeTitle(b.item.title)
            .toLowerCase()
            .includes(normalizedQuery)
            ? 1
            : 0;
          if (bContains !== aContains) return bContains - aContains;
          if (b.sourceNames.length !== a.sourceNames.length)
            return b.sourceNames.length - a.sourceNames.length;
          return (b.item.weight ?? 0) - (a.item.weight ?? 0);
        })
        .slice(0, 12);
    };

    const readSearchCache = (query: string): SearchCachePayload | null => {
      if (typeof window === 'undefined' || !query.trim()) {
        return null;
      }

      try {
        const cacheKey = `search_cache_${query.trim()}${
          isSpecialSourceContext() ? '_special' : ''
        }`;
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return null;

        const parsed = JSON.parse(cached) as SearchCachePayload;
        if (
          (parsed?.status === 'complete' || parsed?.status === 'partial') &&
          Array.isArray(parsed.results)
        ) {
          return parsed;
        }
      } catch (error) {
        console.error('[Play] 读取缓存失败:', error);
      }
      return null;
    };

    const writeCompleteSearchCache = (
      query: string,
      results: SearchResult[]
    ) => {
      if (typeof window === 'undefined' || !query.trim()) return;

      try {
        const cacheKey = `search_cache_${query.trim()}${
          isSpecialSourceContext() ? '_special' : ''
        }`;
        const payload: SearchCachePayload = {
          status: 'complete',
          results,
          query: query.trim(),
          updatedAt: Date.now(),
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (error) {
        console.error('[Play] 写入缓存失败:', error);
      }
    };

    const filterSourcesForCurrentVideo = (
      items: SearchResult[]
    ): SearchResult[] => {
      return items.filter(
        (result: SearchResult) =>
          normalizeTitle(result.title).toLowerCase() ===
            normalizeTitle(videoTitleRef.current).toLowerCase() &&
          (videoYearRef.current
            ? result.year.toLowerCase() ===
                videoYearRef.current.toLowerCase() ||
              !result.year ||
              result.year.trim() === '' ||
              result.year === 'unknown' ||
              !/^\d{4}$/.test(result.year)
            : true) &&
          (searchType ? getType(result) === searchType : true)
      );
    };

    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      // 根据搜索词获取全部源信息
      setHasCompletedSearchRequest(false);
      setFallbackRecommendations([]);

      let fallbackCachedResults: SearchResult[] = [];

      try {
        const cachedPayload = readSearchCache(query);
        if (cachedPayload) {
          console.log(
            `[Play] 使用 sessionStorage ${
              cachedPayload.status === 'partial' ? '临时' : '完整'
            }缓存的搜索结果`
          );
          setFallbackRecommendations(
            buildFallbackRecommendations(cachedPayload.results, query)
          );

          const cachedResults = filterSourcesForCurrentVideo(
            cachedPayload.results
          );
          fallbackCachedResults = cachedResults;
          setAvailableSources(applyCorrectionsToSources(cachedResults));

          if (cachedPayload.status === 'complete') {
            setHasCompletedSearchRequest(true);
            return cachedResults;
          }
        }

        // 没有缓存或只有 partial 缓存时，重新请求完整搜索结果
        const response = await fetch(
          appendSpecialSourceParam(
            `/api/search?q=${encodeURIComponent(query.trim())}`
          )
        );
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();
        const allResults = (data.results || []) as SearchResult[];

        writeCompleteSearchCache(query, allResults);
        setHasCompletedSearchRequest(true);
        setFallbackRecommendations(
          buildFallbackRecommendations(allResults, query)
        );

        const results = filterSourcesForCurrentVideo(allResults);
        setAvailableSources(applyCorrectionsToSources(results));
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        if (fallbackCachedResults.length > 0) {
          return fallbackCachedResults;
        }
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const getCachedSourcesData = (query: string): SearchResult[] => {
      const cachedPayload = readSearchCache(query);
      if (!cachedPayload) {
        return [];
      }

      return applyCorrectionsToSources(
        filterSourcesForCurrentVideo(cachedPayload.results)
      );
    };

    const initAll = async () => {
      if (currentSource === 'directplay') {
        if (!currentId) {
          setError('缺少直链地址');
          setLoading(false);
          return;
        }

        setLoading(true);
        setLoadingStage('fetching');
        setLoadingMessage('🎬 正在准备直链播放...');

        let directUrl = '';
        try {
          directUrl = base58Decode(currentId);
        } catch (decodeError) {
          console.error('直链地址解析失败:', decodeError);
          setError('直链地址解析失败');
          setLoading(false);
          return;
        }

        const directTitle = searchParams.get('title')?.trim() || '直链播放';
        const directDetail: SearchResult = {
          id: currentId,
          title: directTitle,
          poster: '',
          episodes: [directUrl],
          episodes_titles: ['直链'],
          source: 'directplay',
          source_name: '直链',
          class: '',
          year: '',
          desc: '',
          type_name: '',
          douban_id: 0,
        };

        setNeedPrefer(false);
        setCurrentSource('directplay');
        setCurrentId(currentId);
        setVideoTitle(directTitle);
        setVideoYear('');
        setVideoCover('');
        setVideoDoubanId(0);
        setCorrectedDesc('');
        setDetail(directDetail);
        setSourceProxyMode(false);
        setAvailableSources([directDetail]);
        setCurrentEpisodeIndex(0);
        setSourceSearchError(null);
        setSourceSearchLoading(false);
        setBackgroundSourcesLoading(false);

        const newUrl = new URL(
          playbackSession.href || '/play',
          window.location.origin
        );
        newUrl.searchParams.set('source', 'directplay');
        newUrl.searchParams.set('id', currentId);
        newUrl.searchParams.delete('prefer');
        newUrl.searchParams.delete('fileName');
        commitPlaybackHref(newUrl);

        setLoadingStage('ready');
        setLoadingMessage('✨ 准备就绪，即将开始播放...');
        setTimeout(() => {
          setLoading(false);
        }, 500);
        return;
      }

      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '🎬 正在获取视频详情...'
          : '🔍 正在搜索播放源...'
      );

      // 如果已经有了source和id，优先通过单个详情接口快速获取
      let detailData: SearchResult | null = null;
      let sourcesInfo: SearchResult[] = [];

      if (currentSource && currentId) {
        const cachedSources = getCachedSourcesData(searchTitle || videoTitle);
        const cachedTarget = cachedSources.find(
          (source) => source.source === currentSource && source.id === currentId
        );

        if (cachedTarget?.episodes?.length) {
          detailData = cachedTarget;
          sourcesInfo = cachedSources;
          setAvailableSources(cachedSources);
          setSourceSearchLoading(false);
        } else {
          // 先快速获取当前源的详情
          try {
            // currentSource 已经是完整格式（如 'emby_wumei'）
            // 如果是小雅源且有fileName参数，传递给API
            const currentSourceDetail = await fetchSourceDetail(
              currentSource,
              currentId,
              searchTitle || videoTitle,
              currentSource === 'xiaoya' ? fileName : undefined
            );
            if (currentSourceDetail.length > 0) {
              detailData = currentSourceDetail[0];
              sourcesInfo = currentSourceDetail;
            }
          } catch (err) {
            console.error('获取当前源详情失败:', err);
          }
        }

        // 异步获取其他源信息，不阻塞播放
        setBackgroundSourcesLoading(true);
        fetchSourcesData(searchTitle || videoTitle)
          .then((sources) => {
            // 合并当前源和搜索到的其他源
            const allSources = [...sourcesInfo];
            sources.forEach((source) => {
              // 避免重复添加当前源
              if (
                !(source.source === currentSource && source.id === currentId)
              ) {
                allSources.push(source);
              }
            });
            setAvailableSources(applyCorrectionsToSources(allSources));
            setBackgroundSourcesLoading(false);
          })
          .catch((err) => {
            console.error('异步获取其他源失败:', err);
            setBackgroundSourcesLoading(false);
          });
      } else {
        // 没有source和id，正常搜索流程
        sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      }

      if (!detailData && sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      if (!detailData) {
        detailData = sourcesInfo[0];
      }
      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) => source.source === currentSource && source.id === currentId
        );
        if (target) {
          detailData = target;

          // 这类源统一通过详情接口补全播放数据
          if (
            isLazyDetailSource(detailData.source) &&
            (!detailData.episodes || detailData.episodes.length === 0)
          ) {
            console.log('[Play] Fetching lazy detail for selected source...');
            // currentSource 已经是完整格式
            const detailSources = await fetchSourceDetail(
              currentSource,
              currentId,
              searchTitle || videoTitle
            );
            if (detailSources.length > 0) {
              detailData = detailSources[0];
            }
          }
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('⚡ 正在优选最佳播放源...');

        // 过滤掉 openlist、所有 emby 源和 xiaoya 源，它们不参与测速
        const sourcesToTest = sourcesInfo.filter((s) => {
          // 检查是否为 openlist
          if (s.source === 'openlist') return false;

          // 检查是否为 emby 源（包括 emby 和 emby_xxx 格式）
          if (s.source === 'emby' || s.source.startsWith('emby_')) return false;

          // 检查是否为 xiaoya 源
          if (s.source === 'xiaoya') return false;

          // 脚本源详情懒加载，不参与测速
          if (s.source.startsWith('script:')) return false;

          return true;
        });

        const excludedSources = sourcesInfo.filter(
          (s) =>
            s.source === 'openlist' ||
            s.source === 'emby' ||
            s.source.startsWith('emby_') ||
            s.source === 'xiaoya' ||
            s.source.startsWith('script:')
        );

        if (sourcesToTest.length > 0) {
          detailData = await preferBestSource(sourcesToTest);
        } else if (excludedSources.length > 0) {
          // 如果只有懒加载详情的源，直接使用第一个
          detailData = excludedSources[0];
        } else {
          detailData = sourcesInfo[0];
        }
      }

      console.log(detailData.source, detailData.id);

      // 这类源统一通过详情接口补全播放数据
      if (
        isLazyDetailSource(detailData.source) &&
        (!detailData.episodes || detailData.episodes.length === 0)
      ) {
        console.log('[Play] Fetching lazy detail after source selection...');
        const detailSources = await fetchSourceDetail(
          detailData.source,
          detailData.id,
          detailData.title || videoTitleRef.current
        );
        if (detailSources.length > 0) {
          detailData = detailSources[0];
        }
      }

      setNeedPrefer(false);
      // 直接使用 detailData.source（已经是完整格式）
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);

      // 如果是小雅源，检查并应用纠错信息
      if (detailData.source === 'xiaoya') {
        const correction = getXiaoyaCorrection(
          detailData.source,
          detailData.id
        );
        if (correction) {
          console.log('发现小雅源纠错信息，正在应用...', correction);
          detailData = applyCorrection(detailData, correction);
          // 同时设置纠错后的描述
          if (correction.overview) {
            setCorrectedDesc(correction.overview);
          }
        }
      }

      // 更新所有相关状态（在应用纠错信息之后）
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setVideoDoubanId(detailData.douban_id || 0);

      setDetail(detailData);
      setSourceProxyMode(detailData.proxyMode || false); // 从 detail 数据中读取代理模式
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(
        playbackSession.href || '/play',
        window.location.origin
      );
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      // 只有当元数据不是从文件获取时，才删除fileName参数
      if (detailData.metadataSource !== 'file') {
        newUrl.searchParams.delete('fileName');
      }
      commitPlaybackHref(newUrl);

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪，即将开始播放...');

      // 加载播放记录
      try {
        const detailEpisodeProgressContentKey = buildEpisodeProgressContentKey({
          doubanId: detailData.douban_id,
          tmdbId: detailData.tmdb_id,
          title: initialEpisodeProgressTitle,
          year: initialEpisodeProgressYear,
          searchType,
        });
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(detailData.source, detailData.id);
        const record = allRecords[key];

        // 确定初始集数索引
        let initialIndex = 0;
        let shouldResumeTime = false;
        // Explicit room/queue selection takes precedence over personal viewing history.
        const requestedIndex = parsePlaybackEpisodeIndex(
          searchParams.get('episode')
        );
        const initialEpisodeIndex =
          requestedIndex !== undefined
            ? Math.min(
                requestedIndex,
                Math.max(0, detailData.episodes.length - 1)
              )
            : detailData.initialEpisodeIndex;

        if (record) {
          // 有播放记录
          const recordIndex = record.index - 1;
          const recordTime = record.play_time;

          // 如果有initialEpisodeIndex（用户从文件点击进入）
          if (initialEpisodeIndex !== undefined) {
            // 如果播放记录的集数和点击的文件集数一致，则使用播放记录的时间
            if (recordIndex === initialEpisodeIndex) {
              initialIndex = recordIndex;
              shouldResumeTime = true;
              resumeTimeRef.current = recordTime;
              console.log(
                '[Play] 播放记录集数与点击文件一致，恢复播放进度:',
                recordTime
              );
            } else {
              // 否则使用点击的文件集数，从头开始播放
              initialIndex = initialEpisodeIndex;
              const localEpisodeTime = loadLocalEpisodeProgress(
                detailEpisodeProgressContentKey,
                initialIndex
              );
              resumeTimeRef.current = localEpisodeTime;
              console.log('[Play] 使用点击的文件集数:', initialIndex);
            }
          } else {
            // 没有initialEpisodeIndex，使用播放记录
            initialIndex = recordIndex;
            shouldResumeTime = true;
            resumeTimeRef.current = recordTime;
            console.log('[Play] 使用播放记录集数:', initialIndex);
          }
        } else {
          // 没有播放记录
          if (initialEpisodeIndex !== undefined) {
            // 使用点击的文件集数
            initialIndex = initialEpisodeIndex;
            resumeTimeRef.current = loadLocalEpisodeProgress(
              detailEpisodeProgressContentKey,
              initialIndex
            );
            console.log(
              '[Play] 没有播放记录，使用点击的文件集数:',
              initialIndex
            );
          } else {
            // 默认从第0集开始
            initialIndex = 0;
            resumeTimeRef.current = loadLocalEpisodeProgress(
              detailEpisodeProgressContentKey,
              initialIndex
            );
            console.log('[Play] 没有播放记录，从第0集开始');
          }
        }

        // 更新当前选集索引
        if (initialIndex < detailData.episodes.length && initialIndex >= 0) {
          setCurrentEpisodeIndex(initialIndex);
          currentEpisodeIndexRef.current = initialIndex;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }

      // 短暂延迟让用户看到完成状态
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initAll();
  }, []);

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
  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string
  ) => {
    try {
      // 标记正在换源，防止 title 变化触发页面刷新
      isSourceChangingRef.current = true;

      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);
      setVideoError(null);
      setCorsFailedUrl(null);
      proxyAttemptedRef.current = false;

      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      // 清除并设置下一个跳过片头片尾配置
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deleteSkipConfig(
            currentSourceRef.current,
            currentIdRef.current
          );
          await saveSkipConfig(newSource, newId, skipConfigRef.current);
        } catch (err) {
          console.error('清除跳过片头片尾配置失败:', err);
        }
      }

      let newDetail: SearchResult | undefined = availableSources.find(
        (source) => source.source === newSource && source.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // 这类源统一通过详情接口补全播放数据
      if (
        isLazyDetailSource(newDetail.source) &&
        (!newDetail.episodes || newDetail.episodes.length === 0)
      ) {
        try {
          const detailResponse = await fetch(
            appendSpecialSourceParam(
              `/api/source-detail?source=${newSource}&id=${newId}&title=${encodeURIComponent(
                newTitle
              )}`
            )
          );
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            if (!detailData) {
              throw new Error('获取的详情数据为空');
            }
            newDetail = detailData;
          } else {
            throw new Error('获取视频详情失败');
          }
        } catch (err) {
          console.error('获取视频详情失败:', err);
          setIsVideoLoading(false);
          setError('获取视频详情失败，请重试');
          return;
        }
      }

      // 再次确认 newDetail 不为空（类型守卫）
      if (!newDetail) {
        setError('视频详情数据无效');
        return;
      }

      const newEpisodeProgressContentKey = buildEpisodeProgressContentKey({
        doubanId: newDetail.douban_id,
        tmdbId: newDetail.tmdb_id,
        title: initialEpisodeProgressTitle,
        year: initialEpisodeProgressYear,
        searchType,
      });

      // 尝试跳转到当前正在播放的集数
      const previousEpisodeIndex = currentEpisodeIndexRef.current;
      const previousSource = currentSourceRef.current;
      const previousId = currentIdRef.current;
      let targetIndex = previousEpisodeIndex;

      // 如果新源的集数跟旧源的集数不一致，清除当前剧集的所有弹幕缓存
      const oldEpisodeCount = detail?.episodes?.length || 0;
      const newEpisodeCount = newDetail.episodes?.length || 0;
      if (
        oldEpisodeCount > 0 &&
        newEpisodeCount > 0 &&
        oldEpisodeCount !== newEpisodeCount
      ) {
        const titleForCache = detail?.title || videoTitle;
        console.log(
          `换源集数不一致 (${oldEpisodeCount} -> ${newEpisodeCount})，清除弹幕缓存: ${titleForCache}`
        );
        clearDanmakuCacheByTitle(titleForCache).catch((err) => {
          console.error('清除弹幕缓存失败:', err);
        });
      }

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      const isSameEpisodeSwitch = targetIndex === previousEpisodeIndex;
      const resumeTime = isSameEpisodeSwitch
        ? await getSourceSwitchResumeTime(previousEpisodeIndex, currentPlayTime)
        : loadLocalEpisodeProgress(newEpisodeProgressContentKey, targetIndex);
      resumeTimeRef.current = resumeTime;

      // 更新URL参数（不刷新页面）
      const newUrl = new URL(
        playbackSession.href || '/play',
        window.location.origin
      );
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      newUrl.searchParams.set('title', newDetail.title || newTitle);
      commitPlaybackHref(newUrl);

      // 如果是小雅源，检查并应用纠错信息
      let finalTitle = newDetail.title || newTitle;
      let finalCover = newDetail.poster;
      let finalDesc = '';

      if (newDetail.source === 'xiaoya') {
        const correction = getXiaoyaCorrection(newDetail.source, newDetail.id);
        if (correction) {
          console.log('换源到小雅源，发现纠错信息，正在应用...', correction);
          if (correction.title) {
            finalTitle = correction.title;
          }
          if (correction.posterPath) {
            finalCover = processImageUrl(
              getTMDBImageUrl(correction.posterPath)
            );
          }
          if (correction.overview) {
            finalDesc = correction.overview;
          }
          // 应用纠错信息到 newDetail
          newDetail = applyCorrection(newDetail, correction);
        }
      }

      setVideoTitle(finalTitle);
      setVideoYear(newDetail.year);
      setVideoCover(finalCover);
      setCorrectedDesc(finalDesc);
      setVideoDoubanId(newDetail.douban_id || 0);

      if (isSameEpisodeSwitch && resumeTime && resumeTime > 1) {
        const currentDuration = artPlayerRef.current?.duration || 0;
        saveLocalEpisodeProgress(
          newEpisodeProgressContentKey,
          targetIndex,
          resumeTime,
          currentDuration
        );

        try {
          const migratedRecord = {
            title: finalTitle,
            source_name: newDetail.source_name || '',
            year: newDetail.year || '',
            cover: finalCover || '',
            index: targetIndex + 1,
            total_episodes: newDetail.episodes?.length || 1,
            play_time: Math.floor(resumeTime),
            total_time: Math.floor(currentDuration),
            save_time: Date.now(),
            search_title: searchTitle,
          };

          if (previousSource && previousId) {
            await migratePlayRecord(
              previousSource,
              previousId,
              newSource,
              newId,
              migratedRecord
            );
          } else {
            await savePlayRecord(newSource, newId, migratedRecord);
          }
        } catch (error) {
          console.warn(
            '[Play] Failed to migrate source-switch play record:',
            error
          );
        }
      }

      // newSource 已经是完整格式
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setSourceProxyMode(newDetail.proxyMode || false); // 从 detail 数据中读取代理模式
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

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
  // 弹幕处理函数
  // ---------------------------------------------------------------------------

  /**
   * 智能过滤弹幕源：优先匹配年份和标题完全相同的源
   * @param animes 所有搜索到的弹幕源
   * @param videoTitle 视频标题
   * @param videoYear 视频年份（如 "2024"）
   * @returns 过滤后的弹幕源列表
   */
  const filterDanmakuSources = (
    animes: DanmakuAnime[],
    videoTitle: string,
    videoYear?: string
  ): DanmakuAnime[] => {
    if (animes.length <= 1) return animes;

    // 标准化标题：移除空格、全角转半角
    const normalizeTitle = (title: string): string => {
      return title
        .replace(/\s+/g, '')
        .replace(/[\uff01-\uff5e]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
        )
        .toLowerCase();
    };

    // 从日期字符串中提取年份（如 "2024-01" -> "2024"）
    const extractYear = (dateStr?: string): string | null => {
      if (!dateStr) return null;
      const match = dateStr.match(/^(\d{4})/);
      return match ? match[1] : null;
    };

    const normalizedVideoTitle = normalizeTitle(videoTitle);

    // 第一步：尝试同时匹配年份和标题
    if (videoYear) {
      const exactMatches = animes.filter((anime) => {
        const animeYear = extractYear(anime.startDate);
        const normalizedAnimeTitle = normalizeTitle(anime.animeTitle);
        return (
          animeYear === videoYear &&
          normalizedAnimeTitle === normalizedVideoTitle
        );
      });

      if (exactMatches.length > 0) {
        console.log(
          `[弹幕匹配] 找到 ${exactMatches.length} 个年份和标题完全匹配的源`
        );
        return exactMatches;
      }
    }

    // 第二步：如果没有完全匹配，尝试只匹配标题
    const titleMatches = animes.filter((anime) => {
      const normalizedAnimeTitle = normalizeTitle(anime.animeTitle);
      return normalizedAnimeTitle === normalizedVideoTitle;
    });

    if (titleMatches.length > 0) {
      console.log(`[弹幕匹配] 找到 ${titleMatches.length} 个标题完全匹配的源`);
      return titleMatches;
    }

    // 第三步：如果只匹配年份
    if (videoYear) {
      const yearMatches = animes.filter((anime) => {
        const animeYear = extractYear(anime.startDate);
        return animeYear === videoYear;
      });

      if (yearMatches.length > 0) {
        console.log(`[弹幕匹配] 找到 ${yearMatches.length} 个年份匹配的源`);
        return yearMatches;
      }
    }

    // 如果都没有匹配，返回所有源
    console.log('[弹幕匹配] 未找到精确匹配，返回所有源');
    return animes;
  };

  // 匹配弹幕集数：优先根据集数标题中的数字匹配，降级到索引匹配
  const matchDanmakuEpisode = (
    currentEpisodeIndex: number,
    danmakuEpisodes: Array<{ episodeId: number; episodeTitle: string }>,
    videoEpisodeTitle?: string
  ) => {
    if (!danmakuEpisodes.length) return null;

    const extractEpisodeNumber = (title: string): number | null => {
      if (!title) return null;

      // 优先匹配 Emby 格式：S01E01, S02E09 等
      const embyMatch = title.match(/[Ss]\d+[Ee](\d+)/);
      if (embyMatch) {
        return parseInt(embyMatch[1], 10);
      }

      // 降级到原本的策略：纯数字或"第X集/话"格式
      const match = title.match(/^(\d+)$|第?\s*(\d+)\s*[集话話]?/);
      return match ? parseInt(match[1] || match[2], 10) : null;
    };

    if (videoEpisodeTitle) {
      const episodeNum = extractEpisodeNumber(videoEpisodeTitle);
      if (episodeNum !== null) {
        for (const ep of danmakuEpisodes) {
          const danmakuNum = extractEpisodeNumber(ep.episodeTitle);
          if (danmakuNum === episodeNum) {
            console.log(
              `[弹幕匹配] 根据集数标题匹配: ${videoEpisodeTitle} -> ${ep.episodeTitle}`
            );
            return ep;
          }
        }
      }
    }

    const index = Math.min(currentEpisodeIndex, danmakuEpisodes.length - 1);
    console.log(
      `[弹幕匹配] 降级到索引匹配: 索引 ${currentEpisodeIndex} -> ${danmakuEpisodes[index].episodeTitle}`
    );
    return danmakuEpisodes[index];
  };

  // 加载弹幕到播放器
  const loadDanmaku = async (
    episodeId: number,
    metadata?: {
      animeId?: number;
      animeTitle?: string;
      episodeTitle?: string;
      searchKeyword?: string;
      danmakuCount?: number;
      bypassCache?: boolean;
    }
  ) => {
    if (!danmakuPluginRef.current) {
      console.warn('弹幕插件未初始化');
      return;
    }

    // 防止重复加载同一个 episodeId
    if (loadingDanmakuEpisodeIdRef.current === episodeId) {
      console.log(`[弹幕加载] 跳过重复加载: episodeId=${episodeId}`);
      return;
    }

    loadingDanmakuEpisodeIdRef.current = episodeId;
    setDanmakuLoading(true);

    try {
      // 先清空当前弹幕（使用 reset 方法，不触发显示/隐藏事件）
      danmakuPluginRef.current.reset();
      // 强制清空屏幕上的弹幕
      danmakuPluginRef.current.config({ danmuku: [] });
      danmakuPluginRef.current.load();
      setDanmakuCount(0);

      // 通知热力图：弹幕已清空，立即擦除上一集曲线（避免换集后残留）
      if (artPlayerRef.current) {
        artPlayerRef.current.emit('danmaku:loaded');
      }

      // 获取弹幕数据（使用 title + episodeIndex 缓存；episodeIndex 经 ref 读取，避免闭包过期）
      const title = videoTitleRef.current;
      const episodeIndex = currentEpisodeIndexRef.current;

      console.log(
        `[弹幕加载] episodeId=${episodeId}, title="${title}", episodeIndex=${episodeIndex}`
      );

      const comments = await getDanmakuById(
        episodeId,
        title,
        episodeIndex,
        { bypassCache: metadata?.bypassCache === true },
        metadata
      );

      if (comments.length === 0) {
        console.warn('未获取到弹幕数据');
        setDanmakuLoading(false);
        loadingDanmakuEpisodeIdRef.current = null;
        return;
      }

      // 转换弹幕格式
      let danmakuData = convertDanmakuFormat(comments);

      // 手动应用过滤规则（因为缓存的弹幕不会经过播放器的 filter 函数）
      const filterConfig = danmakuFilterConfigRef.current;
      if (filterConfig && filterConfig.rules.length > 0) {
        const originalCount = danmakuData.length;
        danmakuData = danmakuData.filter((danmu) => {
          for (const rule of filterConfig.rules) {
            // 跳过未启用的规则
            if (!rule.enabled) continue;

            try {
              if (rule.type === 'normal') {
                // 普通模式：字符串包含匹配
                if (danmu.text.includes(rule.keyword)) {
                  return false;
                }
              } else if (rule.type === 'regex') {
                // 正则模式：正则表达式匹配
                if (new RegExp(rule.keyword).test(danmu.text)) {
                  return false;
                }
              }
            } catch (e) {
              console.error('弹幕过滤规则错误:', e);
            }
          }
          return true;
        });
        const filteredCount = originalCount - danmakuData.length;
        if (filteredCount > 0) {
          console.log(
            `弹幕过滤: 原始 ${originalCount} 条，过滤 ${filteredCount} 条，剩余 ${danmakuData.length} 条`
          );
        }
      }

      // 应用弹幕数量限制
      const maxCount =
        typeof window !== 'undefined'
          ? parseInt(localStorage.getItem('danmakuMaxCount') || '5000', 10)
          : 0;
      let calculatedOriginalCount = 0;
      if (maxCount > 0 && danmakuData.length > maxCount) {
        const originalCount = danmakuData.length;
        const step = danmakuData.length / maxCount;
        const limitedData = [];
        for (let i = 0; i < maxCount; i++) {
          limitedData.push(danmakuData[Math.floor(i * step)]);
        }
        danmakuData = limitedData;
        calculatedOriginalCount = originalCount;
        setDanmakuOriginalCount(originalCount);
        console.log(
          `弹幕数量限制: 原始 ${originalCount} 条，限制到 ${danmakuData.length} 条`
        );
      } else {
        setDanmakuOriginalCount(0);
      }

      // 加载弹幕到插件，同时应用当前的弹幕设置
      const currentSettings = danmakuSettingsRef.current;
      danmakuPluginRef.current.config({
        danmuku: danmakuData,
        speed: currentSettings.speed,
        opacity: currentSettings.opacity,
        fontSize: currentSettings.fontSize,
        margin: [currentSettings.marginTop, currentSettings.marginBottom],
        synchronousPlayback: currentSettings.synchronousPlayback,
      });
      danmakuPluginRef.current.load();

      // 通知热力图更新（首次播放/换集后绘制新曲线）
      if (artPlayerRef.current) {
        artPlayerRef.current.emit('danmaku:loaded');
      }

      // 根据保存的显示状态来决定显示或隐藏弹幕
      const savedDisplayState = loadDanmakuDisplayState();
      if (savedDisplayState === false) {
        danmakuPluginRef.current.hide();
      } else {
        danmakuPluginRef.current.show();
      }

      setDanmakuCount(danmakuData.length);
      console.log(`弹幕加载成功，共 ${danmakuData.length} 条`);

      // 更新当前选择状态，包含弹幕数量
      if (metadata) {
        setCurrentDanmakuSelection({
          animeId: metadata.animeId || 0,
          episodeId: episodeId,
          animeTitle: metadata.animeTitle || '',
          episodeTitle: metadata.episodeTitle || '',
          searchKeyword: metadata.searchKeyword,
          danmakuCount: danmakuData.length,
          danmakuOriginalCount:
            calculatedOriginalCount > 0 ? calculatedOriginalCount : undefined,
        });
      }

      // 延迟一下让用户看到弹幕数量
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('加载弹幕失败:', error);
      setDanmakuCount(0);
    } finally {
      setDanmakuLoading(false);
      loadingDanmakuEpisodeIdRef.current = null;
    }
  };

  // 预加载下一集弹幕（完全复制 loadDanmakuForCurrentEpisode 的逻辑）
  const preloadNextEpisodeDanmaku = async () => {
    try {
      if (isDirectPlay) return;
      if (isDanmakuAutoLoadDisabled()) return;

      const title = videoTitleRef.current;
      if (!title) {
        return;
      }

      const currentIdx = currentEpisodeIndexRef.current;
      const nextEpisodeIndex = currentIdx + 1;

      // 1. 检查是否有下一集
      const episodes = detailRef.current?.episodes;
      if (!episodes || nextEpisodeIndex >= episodes.length) {
        return;
      }

      // 2. 检查缓存是否已存在
      const cachedData = await getDanmakuFromCache(title, nextEpisodeIndex);
      if (cachedData && cachedData.comments.length > 0) {
        return;
      }

      // 3. 检查是否有手动选择的剧集 ID
      const manualEpisodeId = getManualDanmakuSelection(
        title,
        nextEpisodeIndex
      );
      if (manualEpisodeId) {
        try {
          await getDanmakuById(manualEpisodeId, title, nextEpisodeIndex);
          return;
        } catch (error) {
          // 继续执行后续逻辑
        }
      }

      // 4. 尝试使用保存的动漫ID自动匹配剧集
      const savedAnimeId = getDanmakuAnimeId(title);
      if (savedAnimeId) {
        try {
          const episodesResult = await getEpisodes(savedAnimeId);

          if (
            episodesResult.success &&
            episodesResult.bangumi.episodes.length > 0
          ) {
            const nextVideoEpTitle =
              detailRef.current?.episodes_titles?.[nextEpisodeIndex];
            const episode = matchDanmakuEpisode(
              nextEpisodeIndex,
              episodesResult.bangumi.episodes,
              nextVideoEpTitle
            );

            if (episode) {
              await getDanmakuById(
                episode.episodeId,
                title,
                nextEpisodeIndex,
                undefined,
                {
                  animeId: savedAnimeId,
                  animeTitle: episodesResult.bangumi.animeTitle,
                  episodeTitle: episode.episodeTitle,
                }
              );
              return;
            }
          }
        } catch (error) {
          // 继续执行后续逻辑
        }
      }

      // 5. 执行自动搜索弹幕
      const savedKeyword = getDanmakuSearchKeyword(title);
      const searchKeyword = savedKeyword || title;

      const searchResult = await searchAnime(searchKeyword);
      if (!searchResult.success || searchResult.animes.length === 0) {
        return;
      }

      // 应用智能过滤
      const videoYear = detailRef.current?.year;
      const filteredAnimes = filterDanmakuSources(
        searchResult.animes,
        title,
        videoYear
      );

      if (filteredAnimes.length === 0) {
        return;
      }

      // 检查是否有记忆的选择
      let selectedAnime = filteredAnimes[0];
      if (filteredAnimes.length > 1) {
        const rememberedIndex = getDanmakuSourceIndex(title);
        if (
          rememberedIndex !== null &&
          rememberedIndex < filteredAnimes.length
        ) {
          selectedAnime = filteredAnimes[rememberedIndex];
        }
      }

      // 获取剧集列表并匹配
      const episodesResult = await getEpisodes(selectedAnime.animeId);
      if (
        episodesResult.success &&
        episodesResult.bangumi.episodes.length > 0
      ) {
        const nextVideoEpTitle =
          detailRef.current?.episodes_titles?.[nextEpisodeIndex];
        const episode = matchDanmakuEpisode(
          nextEpisodeIndex,
          episodesResult.bangumi.episodes,
          nextVideoEpTitle
        );

        if (episode) {
          await getDanmakuById(
            episode.episodeId,
            title,
            nextEpisodeIndex,
            undefined,
            {
              animeId: selectedAnime.animeId,
              animeTitle: selectedAnime.animeTitle,
              episodeTitle: episode.episodeTitle,
              searchKeyword: searchKeyword,
            }
          );
        }
      }
    } catch (error) {
      // 静默处理失败
    }
  };

  // 处理上传弹幕
  const handleUploadDanmaku = async (comments: DanmakuComment[]) => {
    setDanmakuLoading(true);

    try {
      // 缓存到IndexedDB
      const title = videoTitleRef.current;
      const episodeIndex = currentEpisodeIndexRef.current;
      if (title) {
        const { saveDanmakuToCache } = await import('@/lib/danmaku/cache');
        await saveDanmakuToCache(title, episodeIndex, comments);
      }

      // 转换弹幕格式
      let danmakuData = convertDanmakuFormat(comments);

      // 应用过滤规则
      const filterConfig = danmakuFilterConfigRef.current;
      if (filterConfig && filterConfig.rules.length > 0) {
        danmakuData = danmakuData.filter((danmu) => {
          for (const rule of filterConfig.rules) {
            if (!rule.enabled) continue;
            try {
              if (rule.type === 'normal') {
                if (danmu.text.includes(rule.keyword)) return false;
              } else if (rule.type === 'regex') {
                if (new RegExp(rule.keyword).test(danmu.text)) return false;
              }
            } catch (e) {
              console.error('弹幕过滤规则错误:', e);
            }
          }
          return true;
        });
      }

      // 应用弹幕数量限制
      const maxCount =
        typeof window !== 'undefined'
          ? parseInt(localStorage.getItem('danmakuMaxCount') || '5000', 10)
          : 0;
      if (maxCount > 0 && danmakuData.length > maxCount) {
        const originalCount = danmakuData.length;
        const step = danmakuData.length / maxCount;
        const limitedData = [];
        for (let i = 0; i < maxCount; i++) {
          limitedData.push(danmakuData[Math.floor(i * step)]);
        }
        danmakuData = limitedData;
        setDanmakuOriginalCount(originalCount);
        console.log(
          `弹幕数量限制: 原始 ${originalCount} 条，限制到 ${danmakuData.length} 条`
        );
      } else {
        setDanmakuOriginalCount(0);
      }

      // 加载弹幕到播放器（使用 reset 方法清空，不触发显示/隐藏事件）
      if (danmakuPluginRef.current) {
        danmakuPluginRef.current.reset();

        const currentSettings = danmakuSettingsRef.current;
        danmakuPluginRef.current.config({
          danmuku: danmakuData,
          speed: currentSettings.speed,
          opacity: currentSettings.opacity,
          fontSize: currentSettings.fontSize,
          margin: [currentSettings.marginTop, currentSettings.marginBottom],
          synchronousPlayback: currentSettings.synchronousPlayback,
        });
        danmakuPluginRef.current.load();

        // 触发自定义事件通知热力图更新
        if (artPlayerRef.current) {
          artPlayerRef.current.emit('danmaku:loaded');
        }

        // 根据保存的显示状态来决定显示或隐藏弹幕
        const savedDisplayState = loadDanmakuDisplayState();
        if (savedDisplayState === false) {
          danmakuPluginRef.current.hide();
        } else {
          danmakuPluginRef.current.show();
        }
      }

      setDanmakuCount(danmakuData.length);
      if (artPlayerRef.current) {
        artPlayerRef.current.notice.show = `上传成功，共 ${danmakuData.length} 条弹幕`;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error('上传弹幕失败:', error);
      if (artPlayerRef.current) {
        artPlayerRef.current.notice.show = '弹幕加载失败';
      }
    } finally {
      setDanmakuLoading(false);
    }
  };

  // 处理弹幕选择
  const handleDanmakuSelect = async (
    selection: DanmakuSelection,
    isManual = false
  ) => {
    console.log(`[弹幕选择] isManual=${isManual}, selection:`, selection);
    setCurrentDanmakuSelection(selection);

    // 只有手动选择时才保存到 sessionStorage
    if (isManual) {
      const title = videoTitleRef.current;
      const episodeIndex = currentEpisodeIndexRef.current;
      if (title && episodeIndex >= 0) {
        saveManualDanmakuSelection(title, episodeIndex, selection.episodeId);

        // 保存用户手动选择的动漫ID（用于换集时自动匹配）
        saveDanmakuAnimeId(title, selection.animeId);

        // 保存搜索关键词（如果有的话）
        if (selection.searchKeyword) {
          saveDanmakuSearchKeyword(title, selection.searchKeyword);
          console.log(
            `[弹幕记忆] 保存手动搜索关键词: ${selection.searchKeyword}`
          );
        }
      }
    }

    // 加载弹幕，传递元信息
    await loadDanmaku(selection.episodeId, {
      animeId: selection.animeId,
      animeTitle: selection.animeTitle,
      episodeTitle: selection.episodeTitle,
      searchKeyword: selection.searchKeyword,
      danmakuCount: selection.danmakuCount,
      bypassCache: isManual,
    });
  };

  // 处理用户选择弹幕源
  const handleDanmakuSourceSelect = async (
    selectedAnime: DanmakuAnime,
    selectedIndex?: number,
    isManualSearch = false
  ) => {
    setShowDanmakuSourceSelector(false);

    try {
      const title = videoTitleRef.current;
      console.log(
        '[弹幕] 用户选择弹幕源 - 视频:',
        title,
        '弹幕源:',
        selectedAnime.animeTitle
      );

      // 如果提供了下标，保存到 sessionStorage
      if (selectedIndex !== undefined && title) {
        saveDanmakuSourceIndex(title, selectedIndex);
      }

      // 获取剧集列表
      const episodesResult = await getEpisodes(selectedAnime.animeId);

      if (
        episodesResult.success &&
        episodesResult.bangumi.episodes.length > 0
      ) {
        // 根据当前集数选择对应的弹幕
        const currentEp = currentEpisodeIndexRef.current;
        const videoEpTitle = detailRef.current?.episodes_titles?.[currentEp];
        const episode = matchDanmakuEpisode(
          currentEp,
          episodesResult.bangumi.episodes,
          videoEpTitle
        );

        if (episode) {
          const selection: DanmakuSelection = {
            animeId: selectedAnime.animeId,
            episodeId: episode.episodeId,
            animeTitle: selectedAnime.animeTitle,
            episodeTitle: episode.episodeTitle,
          };

          // 设置剧集列表
          applyDanmakuEpisodes(episodesResult.bangumi.episodes);

          console.log('用户选择弹幕源:', selection);

          // 通过统一的 handleDanmakuSelect 处理弹幕加载
          // 只有从弹幕面板手动搜索选择时才标记为手动选择
          await handleDanmakuSelect(selection, isManualSearch);
        }
      } else {
        console.warn('未找到剧集信息');
      }
    } catch (error) {
      console.error('加载弹幕失败:', error);
    }
  };

  // 手动重新选择弹幕源（忽略记忆）- 保留供将来使用
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleReselectDanmakuSource = async () => {
    const title = videoTitleRef.current;
    if (!title) {
      console.warn('视频标题为空，无法搜索弹幕');
      return;
    }

    console.log('[弹幕] 用户手动重新选择弹幕源 - 视频:', title);
    setDanmakuLoading(true);

    try {
      const searchResult = await searchAnime(title);

      if (searchResult.success && searchResult.animes.length > 0) {
        // 应用智能过滤：优先匹配年份和标题
        const videoYear = detailRef.current?.year;
        const filteredAnimes = filterDanmakuSources(
          searchResult.animes,
          title,
          videoYear
        );

        // 如果有多个匹配结果，让用户选择
        if (filteredAnimes.length > 1) {
          console.log(`[弹幕] 找到 ${filteredAnimes.length} 个弹幕源`);
          setDanmakuMatches(filteredAnimes);
          setShowDanmakuSourceSelector(true);
          setDanmakuLoading(false);
          return;
        }

        // 只有一个结果，直接使用
        const anime = filteredAnimes[0];
        await handleDanmakuSourceSelect(anime);
      } else {
        console.warn('[弹幕] 未找到匹配的弹幕');
        if (artPlayerRef.current) {
          artPlayerRef.current.notice.show = '未找到匹配的弹幕源';
        }
        setDanmakuLoading(false);
      }
    } catch (error) {
      console.error('[弹幕] 搜索失败:', error);
      setDanmakuLoading(false);
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
  const saveCurrentPlayProgress = async () => {
    if (
      !artPlayerRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current ||
      !videoTitleRef.current ||
      !detailRef.current?.source_name
    ) {
      return;
    }

    const player = artPlayerRef.current;
    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;
    const playTime = Math.floor(currentTime);

    // 如果播放时间太短（少于5秒）或者视频时长无效，不保存
    if (currentTime < 1 || !duration) {
      return;
    }

    if (lastSavedPlayTimeRef.current === playTime) {
      return;
    }

    try {
      saveLocalEpisodeProgress(
        episodeProgressContentKey,
        currentEpisodeIndexRef.current,
        currentTime,
        duration
      );

      await savePlayRecord(currentSourceRef.current, currentIdRef.current, {
        title: videoTitleRef.current,
        source_name: detailRef.current?.source_name || '',
        year: detailRef.current?.year,
        cover: detailRef.current?.poster || '',
        index: currentEpisodeIndexRef.current + 1, // 转换为1基索引
        total_episodes: detailRef.current?.episodes.length || 1,
        play_time: playTime,
        total_time: Math.floor(duration),
        save_time: Date.now(),
        search_title: searchTitle,
        is_anime: isAnimeCategoryText(
          detailRef.current?.type_name,
          detailRef.current?.class
        ),
      });

      lastSavedPlayTimeRef.current = playTime;
      lastSaveTimeRef.current = Date.now();
      console.log('播放进度已保存:', {
        title: videoTitleRef.current,
        episode: currentEpisodeIndexRef.current + 1,
        year: detailRef.current?.year,
        progress: `${Math.floor(currentTime)}/${Math.floor(duration)}`,
      });
    } catch (err) {
      console.error('保存播放进度失败:', err);
    }
  };

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

  useEffect(() => {
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
        const artplayerPluginDanmuku = DanmukuPlugin.default as any;
        const artplayerPluginAutoThumbnail = AutoThumbnailPlugin.default as any;
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
          theme: 'var(--tm-room-player-text)',
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
            heatmapPlugin(
              () => danmakuPluginRef.current?.option?.danmuku || []
            ),
            ({ art }) => anime4k.attach(art),
            ({ art }) =>
              subtitles.attach(
                art,
                episodeSubtitles(),
                String(currentEpisodeIndexRef.current)
              ),
            // 实例销毁前：保存弹幕设置
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
            artplayerPluginDanmuku({
              danmuku: [],
              speed: danmakuSettingsRef.current.speed,
              opacity: danmakuSettingsRef.current.opacity,
              fontSize: danmakuSettingsRef.current.fontSize,
              color: 'var(--tm-room-player-text)',
              mode: 0,
              margin: [
                danmakuSettingsRef.current.marginTop,
                danmakuSettingsRef.current.marginBottom,
              ],
              antiOverlap: true,
              synchronousPlayback:
                danmakuSettingsRef.current.synchronousPlayback,
              emitter: false,
              heatmap: false, // 禁用 artplayer 自带热力图，使用自定义热力图
              // 主题
              theme: 'dark',
              // 根据保存的显示状态设置初始可见性
              visible: danmakuDisplayStateRef.current,
              filter: (danmu: any) => {
                // 应用过滤规则
                const filterConfig = danmakuFilterConfigRef.current;
                if (filterConfig && filterConfig.rules.length > 0) {
                  for (const rule of filterConfig.rules) {
                    // 跳过未启用的规则
                    if (!rule.enabled) continue;

                    try {
                      if (rule.type === 'normal') {
                        // 普通模式：字符串包含匹配
                        if (danmu.text.includes(rule.keyword)) {
                          return false;
                        }
                      } else if (rule.type === 'regex') {
                        // 正则模式：正则表达式匹配
                        if (new RegExp(rule.keyword).test(danmu.text)) {
                          return false;
                        }
                      }
                    } catch (e) {
                      console.error('弹幕过滤规则错误:', e);
                    }
                  }
                }
                return true;
              },
            }),
          ],
          icons: {
            loading:
              '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
          },
          settings: [
            {
              html: '去广告',
              icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="currentColor">AD</text>',
              tooltip: blockAdEnabled ? '已开启' : '已关闭',
              onClick() {
                const newVal = !blockAdEnabled;
                try {
                  localStorage.setItem('enable_blockad', String(newVal));
                  if (artPlayerRef.current) {
                    resumeTimeRef.current = artPlayerRef.current.currentTime;
                  }
                  setBlockAdEnabled(newVal);
                } catch (_) {
                  // ignore
                }
                return newVal ? '当前开启' : '当前关闭';
              },
            },
            {
              html: '弹幕过滤',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/><path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
              tooltip: '配置弹幕过滤规则',
              onClick() {
                // 如果播放器处于全屏状态，先退出全屏
                if (artPlayerRef.current && artPlayerRef.current.fullscreen) {
                  artPlayerRef.current.fullscreen = false;
                  // 延迟一下再显示弹窗，确保全屏退出动画完成
                  setTimeout(() => {
                    setShowDanmakuFilterSettings(true);
                  }, 300);
                } else {
                  setShowDanmakuFilterSettings(true);
                }
                return '打开设置';
              },
            },
            // 热力图开关（仅在未禁用时显示）
            ...(!danmakuHeatmapDisabledRef.current
              ? [
                  {
                    name: '弹幕热力',
                    html: '弹幕热力',
                    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="currentColor"/></svg>',
                    switch: danmakuHeatmapEnabledRef.current,
                    onSwitch: function (item: any) {
                      const newVal = !item.switch;
                      setHeatmapEnabled(artPlayerRef.current, newVal);
                      setDanmakuHeatmapEnabled(newVal);
                      return newVal;
                    },
                  },
                ]
              : []),
            ...(webGPUSupported
              ? [
                  {
                    name: 'Anime4K超分',
                    html: 'Anime4K超分',
                    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4 0-7-3-7-7V9l7-3.5L19 9v4c0 4-3 7-7 7z" fill="currentColor"/><path d="M10 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                    switch: anime4k.state.enabled,
                    onSwitch: async function (item: any) {
                      await anime4k.setEnabled(!item.switch);
                      return anime4k.state.enabled;
                    },
                  },
                  {
                    name: '超分模式',
                    html: '超分模式',
                    selector: [
                      {
                        html: 'ModeA (快速)',
                        value: 'ModeA',
                        default: anime4k.state.mode === 'ModeA',
                      },
                      {
                        html: 'ModeB (平衡)',
                        value: 'ModeB',
                        default: anime4k.state.mode === 'ModeB',
                      },
                      {
                        html: 'ModeC (质量)',
                        value: 'ModeC',
                        default: anime4k.state.mode === 'ModeC',
                      },
                      {
                        html: 'ModeAA (增强快速)',
                        value: 'ModeAA',
                        default: anime4k.state.mode === 'ModeAA',
                      },
                      {
                        html: 'ModeBB (增强平衡)',
                        value: 'ModeBB',
                        default: anime4k.state.mode === 'ModeBB',
                      },
                      {
                        html: 'ModeCA (最高质量)',
                        value: 'ModeCA',
                        default: anime4k.state.mode === 'ModeCA',
                      },
                    ],
                    onSelect: async function (item: any) {
                      await anime4k.setMode(item.value);
                      return item.html;
                    },
                  },
                  {
                    name: '超分倍数',
                    html: '超分倍数',
                    selector: [
                      {
                        html: '1.5x',
                        value: '1.5',
                        default: anime4k.state.scale === 1.5,
                      },
                      {
                        html: '2.0x',
                        value: '2.0',
                        default: anime4k.state.scale === 2.0,
                      },
                      {
                        html: '3.0x',
                        value: '3.0',
                        default: anime4k.state.scale === 3.0,
                      },
                      {
                        html: '4.0x',
                        value: '4.0',
                        default: anime4k.state.scale === 4.0,
                      },
                    ],
                    onSelect: async function (item: any) {
                      await anime4k.setScale(parseFloat(item.value));
                      return item.html;
                    },
                  },
                ]
              : []),
            {
              name: '跳过片头片尾',
              html: '跳过片头片尾',
              switch: skipConfigRef.current.enable,
              onSwitch: function (item: any) {
                const newConfig = {
                  ...skipConfigRef.current,
                  enable: !item.switch,
                };
                handleSkipConfigChange(newConfig);
                return !item.switch;
              },
            },
            {
              name: '快捷快进配置',
              html: '快捷快进配置',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m16 17 5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
              tooltip: `${formatQuickForwardDuration(
                quickForwardSecondsRef.current
              )}`,
              onClick: async function () {
                const player = artPlayerRef.current;
                if (player?.fullscreen) {
                  player.fullscreen = false;
                  await new Promise((resolve) => setTimeout(resolve, 300));
                }

                const existingDialog = document.querySelector(
                  '.quick-forward-settings-dialog'
                );
                existingDialog?.remove();

                const container = document.createElement('div');
                container.className = 'quick-forward-settings-dialog';
                container.style.cssText = `
                  position: fixed;
                  inset: 0;
                  z-index: 10000;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 16px;
                  background: rgba(0, 0, 0, 0.6);
                  backdrop-filter: blur(3px);
                `;
                container.innerHTML = `
                  <div role="dialog" aria-modal="true" style="width: min(360px, 100%); background: var(--tm-surface); color: var(--tm-text); border: 1px solid var(--tm-line); border-radius: var(--tm-radius-md); padding: 20px; box-shadow: 0 16px 48px var(--tm-room-cinema-bg);">
                    <div style="font-size: 17px; font-weight: 500; margin-bottom: 8px;">快捷快进设置</div>
                    <div style="color: var(--tm-text); font-size: 13px; line-height: 1.5; margin-bottom: 16px;">设置点击底部按钮或按 P 键时向前跳转的时间。</div>
                    <label for="quick-forward-input" style="display: block; color: var(--tm-text); font-size: 13px; margin-bottom: 6px;">快进时长（秒）</label>
                    <input id="quick-forward-input" type="number" min="1" step="1" value="${quickForwardSecondsRef.current}" style="box-sizing: border-box; width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); font-size: 14px; outline: none;" />
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
                      <button type="button" data-action="cancel" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); cursor: pointer;">取消</button>
                      <button type="button" data-action="confirm" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-text); color: var(--tm-accent-contrast); cursor: pointer;">保存</button>
                    </div>
                  </div>
                `;
                document.body.appendChild(container);

                const input = container.querySelector(
                  '#quick-forward-input'
                ) as HTMLInputElement;
                const cancelButton = container.querySelector(
                  '[data-action="cancel"]'
                );
                const confirmButton = container.querySelector(
                  '[data-action="confirm"]'
                );
                const cleanup = () => container.remove();
                const save = () => {
                  const normalizedSeconds = normalizeStoredSeconds(
                    Number(input.value)
                  );
                  if (normalizedSeconds === null) {
                    input.focus();
                    if (artPlayerRef.current) {
                      artPlayerRef.current.notice.show =
                        '请输入大于 0 的有效秒数';
                    }
                    return;
                  }

                  setQuickForwardSeconds(normalizedSeconds);
                  quickForwardSecondsRef.current = normalizedSeconds;
                  localStorage.setItem(
                    QUICK_FORWARD_STORAGE_KEY,
                    String(normalizedSeconds)
                  );
                  if (artPlayerRef.current) {
                    artPlayerRef.current.notice.show = `快捷快进已设置为${formatQuickForwardDuration(
                      normalizedSeconds
                    )}`;
                  }
                  cleanup();
                };

                cancelButton?.addEventListener('click', cleanup);
                confirmButton?.addEventListener('click', save);
                container.addEventListener('click', (event) => {
                  if (event.target === container) cleanup();
                });
                input.addEventListener('keydown', (event) => {
                  if (event.key === 'Enter') save();
                  if (event.key === 'Escape') cleanup();
                });
                input.focus();
                input.select();
                return '打开设置';
              },
            },
            {
              name: '快进/倒退时间',
              html: '快进/倒退时间',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m4 12 6-6v12l-6-6Z" fill="currentColor"/><path d="m20 12-6-6v12l6-6Z" fill="currentColor"/></svg>',
              tooltip: `${formatQuickForwardDuration(
                seekStepSecondsRef.current
              )}`,
              onClick: async function () {
                const player = artPlayerRef.current;
                if (player?.fullscreen) {
                  player.fullscreen = false;
                  await new Promise((resolve) => setTimeout(resolve, 300));
                }

                const existingDialog = document.querySelector(
                  '.seek-step-settings-dialog'
                );
                existingDialog?.remove();

                const container = document.createElement('div');
                container.className = 'seek-step-settings-dialog';
                container.style.cssText = `
                  position: fixed;
                  inset: 0;
                  z-index: 10000;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 16px;
                  background: rgba(0, 0, 0, 0.6);
                  backdrop-filter: blur(3px);
                `;
                container.innerHTML = `
                  <div role="dialog" aria-modal="true" style="width: min(360px, 100%); background: var(--tm-surface); color: var(--tm-text); border: 1px solid var(--tm-line); border-radius: var(--tm-radius-md); padding: 20px; box-shadow: 0 16px 48px var(--tm-room-cinema-bg);">
                    <div style="font-size: 17px; font-weight: 500; margin-bottom: 8px;">快进/倒退时间</div>
                    <div style="color: var(--tm-text); font-size: 13px; line-height: 1.5; margin-bottom: 16px;">设置左右方向键快进 / 快退的时间。</div>
                    <label for="seek-step-input" style="display: block; color: var(--tm-text); font-size: 13px; margin-bottom: 6px;">时长（秒）</label>
                    <input id="seek-step-input" type="number" min="1" step="1" value="${seekStepSecondsRef.current}" style="box-sizing: border-box; width: 100%; height: 44px; padding: 0 10px; border: 1px solid var(--tm-line); border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); font-size: 14px; outline: none;" />
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;">
                      <button type="button" data-action="cancel" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-surface); color: var(--tm-text); cursor: pointer;">取消</button>
                      <button type="button" data-action="confirm" style="height: 44px; padding: 0 14px; border: 0; border-radius: var(--tm-radius-sm); background: var(--tm-text); color: var(--tm-accent-contrast); cursor: pointer;">保存</button>
                    </div>
                  </div>
                `;
                document.body.appendChild(container);

                const input = container.querySelector(
                  '#seek-step-input'
                ) as HTMLInputElement;
                const cancelButton = container.querySelector(
                  '[data-action="cancel"]'
                );
                const confirmButton = container.querySelector(
                  '[data-action="confirm"]'
                );
                const cleanup = () => container.remove();
                const save = () => {
                  const normalizedSeconds = normalizeStoredSeconds(
                    Number(input.value)
                  );
                  if (normalizedSeconds === null) {
                    input.focus();
                    if (artPlayerRef.current) {
                      artPlayerRef.current.notice.show =
                        '请输入大于 0 的有效秒数';
                    }
                    return;
                  }

                  setSeekStepSeconds(normalizedSeconds);
                  seekStepSecondsRef.current = normalizedSeconds;
                  localStorage.setItem(
                    SEEK_STEP_STORAGE_KEY,
                    String(normalizedSeconds)
                  );
                  if (artPlayerRef.current) {
                    artPlayerRef.current.notice.show = `快进/倒退时间已设为${formatQuickForwardDuration(
                      normalizedSeconds
                    )}`;
                  }
                  cleanup();
                };

                cancelButton?.addEventListener('click', cleanup);
                confirmButton?.addEventListener('click', save);
                container.addEventListener('click', (event) => {
                  if (event.target === container) cleanup();
                });
                input.addEventListener('keydown', (event) => {
                  if (event.key === 'Enter') save();
                  if (event.key === 'Escape') cleanup();
                });
                input.focus();
                input.select();
                return '打开设置';
              },
            },
            {
              name: '跳过配置',
              html: '跳过配置',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="currentColor"/><path d="M9 12L15 12" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
              tooltip:
                skipConfigRef.current.intro_time === 0 &&
                skipConfigRef.current.outro_time === 0
                  ? '设置跳过配置'
                  : `片头: ${formatTime(
                      skipConfigRef.current.intro_time
                    )} | 片尾: ${formatTime(
                      Math.abs(skipConfigRef.current.outro_time)
                    )}`,
              onClick: async function () {
                const player = artPlayerRef.current;
                if (player) {
                  // 如果处于全屏状态，先退出全屏
                  if (player.fullscreen) {
                    player.fullscreen = false;
                    // 等待全屏退出动画完成
                    await new Promise((resolve) => setTimeout(resolve, 300));
                  }

                  // 使用 ArtPlayer 的 prompt 功能创建输入弹窗
                  const currentIntro = skipConfigRef.current.intro_time || 0;
                  const currentOutro =
                    Math.abs(skipConfigRef.current.outro_time) || 0;

                  // 创建一个自定义的提示框
                  const container = document.createElement('div');
                  container.style.cssText = ` position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.9); padding: 20px; border-radius: var(--tm-radius-sm); z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); `;

                  container.innerHTML = `
                  <div style="color: var(--tm-text); margin-bottom: 15px; font-size: 16px; font-weight: bold; border-bottom: 1px solid var(--tm-line); padding-bottom: 10px;">
                    跳过配置
                  </div>
                  <div style="color: var(--tm-text); font-size: 13px; margin-bottom: 15px; line-height: 1.5;">
                    设置片头片尾跳过时间，到达时间自动跳过
                  </div>
                  <div style="margin-bottom: 10px;">
                    <label style="color: var(--tm-text); display: block; margin-bottom: 5px; font-size: 14px; font-weight: 500;">
                      片头时间 (秒)
                      <span style="color: var(--tm-text); font-size: 13px; font-weight: normal; margin-left: 8px;">从视频开始跳过的时长</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                      <input id="intro-input" type="number" min="0" step="1" value="${currentIntro}" placeholder="如: 90"
                             style="flex: 1; padding: 8px; border-radius: var(--tm-radius-sm); border: 1px solid var(--tm-line); background: var(--tm-surface); color: var(--tm-text); font-size: 14px;" />
                      <button id="set-intro-btn" style="padding: 8px 12px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; white-space: nowrap;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                          <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
                          <path d="M12 6v6l4 4" stroke="white" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        当前时间
                      </button>
                    </div>
                  </div>
                  <div style="margin-bottom: 15px;">
                    <label style="color: var(--tm-text); display: block; margin-bottom: 5px; font-size: 14px; font-weight: 500;">
                      片尾时间 (秒)
                      <span style="color: var(--tm-text); font-size: 13px; font-weight: normal; margin-left: 8px;">从视频结尾向前跳过的时长</span>
                    </label>
                    <div style="display: flex; gap: 8px;">
                      <input id="outro-input" type="number" min="0" step="1" value="${currentOutro}" placeholder="如: 120"
                             style="flex: 1; padding: 8px; border-radius: var(--tm-radius-sm); border: 1px solid var(--tm-line); background: var(--tm-surface); color: var(--tm-text); font-size: 14px;" />
                      <button id="set-outro-btn" style="padding: 8px 12px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; white-space: nowrap;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
                          <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
                          <path d="M12 6v6l4 4" stroke="white" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        当前时间
                      </button>
                    </div>
                  </div>
                  <div style="background: color-mix(in srgb, var(--tm-room-cinema-bg) 55%, transparent); border-left: 3px solid var(--tm-line); padding: 10px; margin-bottom: 15px; border-radius: var(--tm-radius-sm);">
                    <div style="color: var(--tm-text); font-size: 13px; line-height: 1.6;">
                      <div style="margin-bottom: 4px;"><strong>提示：</strong></div>
                      <div>• 点击"当前时间"可快速设置为播放位置</div>
                      <div>• 片头90秒表示跳过前1分30秒</div>
                      <div>• 片尾120秒表示跳过最后2分钟</div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--tm-line); padding-top: 15px;">
                    <button id="cancel-btn" style="padding: 8px 16px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='var(--tm-line)'" onmouseout="this.style.background='var(--tm-surface)'">取消</button>
                    <button id="clear-btn" style="padding: 8px 16px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-surface); color: var(--tm-text); cursor: pointer; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='var(--tm-line)'" onmouseout="this.style.background='var(--tm-surface)'">清除</button>
                    <button id="confirm-btn" style="padding: 8px 16px; border-radius: var(--tm-radius-sm); border: none; background: var(--tm-text); color: var(--tm-accent-contrast); cursor: pointer; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='var(--tm-text)'" onmouseout="this.style.background='var(--tm-text)'">确定</button>
                  </div>
                `;

                  document.body.appendChild(container);

                  const introInput = container.querySelector(
                    '#intro-input'
                  ) as HTMLInputElement;
                  const outroInput = container.querySelector(
                    '#outro-input'
                  ) as HTMLInputElement;
                  const setIntroBtn = container.querySelector('#set-intro-btn');
                  const setOutroBtn = container.querySelector('#set-outro-btn');
                  const cancelBtn = container.querySelector('#cancel-btn');
                  const clearBtn = container.querySelector('#clear-btn');
                  const confirmBtn = container.querySelector('#confirm-btn');

                  const cleanup = () => {
                    document.body.removeChild(container);
                  };

                  // 设置片头为当前时间
                  setIntroBtn?.addEventListener('click', () => {
                    const currentTime = player.currentTime || 0;
                    if (currentTime > 0) {
                      introInput.value = Math.floor(currentTime).toString();
                    }
                  });

                  // 设置片尾为当前时间到结束的时长
                  setOutroBtn?.addEventListener('click', () => {
                    if (player.duration && player.currentTime) {
                      const outroTime = player.duration - player.currentTime;
                      if (outroTime > 0) {
                        outroInput.value = Math.floor(outroTime).toString();
                      }
                    }
                  });

                  cancelBtn?.addEventListener('click', cleanup);

                  clearBtn?.addEventListener('click', () => {
                    handleSkipConfigChange({
                      enable: false,
                      intro_time: 0,
                      outro_time: 0,
                    });
                    cleanup();
                  });

                  confirmBtn?.addEventListener('click', () => {
                    const introTime = parseFloat(introInput.value) || 0;
                    const outroTime = parseFloat(outroInput.value) || 0;

                    const newConfig = {
                      ...skipConfigRef.current,
                      intro_time: introTime,
                      outro_time: outroTime > 0 ? -outroTime : 0,
                    };

                    handleSkipConfigChange(newConfig);
                    cleanup();
                  });

                  // 支持 Enter 键确认
                  const handleEnter = (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      confirmBtn?.dispatchEvent(new Event('click'));
                    } else if (e.key === 'Escape') {
                      cancelBtn?.dispatchEvent(new Event('click'));
                    }
                  };

                  introInput.addEventListener('keydown', handleEnter);
                  outroInput.addEventListener('keydown', handleEnter);
                }
                return '';
              },
            },
          ],
          // 控制栏配置
          controls: [
            {
              // 与内置截图同名同位置，沿用 .art-control-screenshot 的显示规则
              name: 'screenshot',
              position: 'right',
              index: 20,
              html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="2"/></svg></i>',
              tooltip: '截图',
              click: function () {
                const art = artPlayerRef.current;
                if (!art) return;
                art.screenshot().catch(() => {
                  // 片源站点没有开放跨域读取时浏览器禁止读帧，给出能看懂的原因
                  if (artPlayerRef.current) {
                    artPlayerRef.current.notice.show =
                      '这个片源不允许截图，可以换个线路再试';
                  }
                });
              },
            },
            {
              position: 'left',
              index: 40,
              html: `<i class="art-icon flex quick-forward-control"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m16 17 5-5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></i>`,
              tooltip: '快捷快进',
              mounted: ($el: HTMLElement) => {
                $el.classList.add('quick-forward-control-wrapper');
                if (!document.getElementById('quick-forward-control-style')) {
                  const style = document.createElement('style');
                  style.id = 'quick-forward-control-style';
                  style.textContent = `
                    @media (max-width: 767px) and (orientation: portrait) {
                      .quick-forward-control-wrapper {
                        display: none !important;
                      }
                    }
                  `;
                  document.head.appendChild(style);
                }
              },
              click: function () {
                seekQuickForward();
              },
            },
            {
              position: 'left',
              index: 13,
              html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
              tooltip: '播放下一集',
              click: function () {
                handleNextEpisode();
              },
            },
            // iOS 设备上添加自定义全屏按钮（横屏和竖屏都显示）
            ...(isIOS
              ? [
                  {
                    position: 'right',
                    index: 100, // 大数字确保在设置按钮右边
                    html: '<i class="art-icon ios-portrait-fullscreen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/></svg></i>',
                    tooltip: '全屏',
                    style: {
                      color: 'var(--tm-room-player-text)',
                    },
                    mounted: function ($el: HTMLElement) {
                      // 添加 CSS 样式：横屏和竖屏都显示
                      const style = document.createElement('style');
                      style.textContent = ` /* iOS 自定义全屏按钮在所有方向都显示 */ .ios-portrait-fullscreen { display: inline-flex !important; } /* iOS 全屏选择对话框样式（遵循项目统一风格） */ .ios-fullscreen-dialog { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--tm-surface); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; } .ios-fullscreen-dialog-content { background: var(--tm-surface); border-radius: var(--tm-radius-md); max-width: 480px; width: 100%; box-shadow: 0 20px 60px var(--tm-text); overflow: hidden; } .dark .ios-fullscreen-dialog-content { background: var(--tm-surface); } /* 标题栏 */ .ios-fullscreen-dialog-header { background: linear-gradient(135deg, var(--tm-surface) 0%, var(--tm-surface) 100%); padding: 20px 24px; } .ios-fullscreen-dialog-title { font-size: 20px; font-weight: 700; color: var(--tm-text); display: flex; align-items: center; gap: 10px; margin-bottom: 6px; } .ios-fullscreen-dialog-title svg { stroke: var(--tm-text); } .ios-fullscreen-dialog-subtitle { font-size: 14px; color: var(--tm-text); margin: 0; } /* 选项列表 */ .ios-fullscreen-dialog-options { padding: 16px; display: flex; flex-direction: column; gap: 12px; } .ios-fullscreen-option { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--tm-surface); border: 2px solid transparent; border-radius: var(--tm-radius-md); cursor: pointer; transition: all 0.2s; text-align: left; } .dark .ios-fullscreen-option { background: var(--tm-surface); } .ios-fullscreen-option:hover { background: var(--tm-surface); border-color: var(--tm-line); box-shadow: 0 4px 12px var(--tm-text); } .dark .ios-fullscreen-option:hover { background: var(--tm-surface); } .ios-fullscreen-option:active { transform: scale(0.98); } /* 推荐选项 */ .ios-fullscreen-option-recommended { border-color: var(--tm-line); } /* 选项图标 */ .ios-fullscreen-option-icon { flex-shrink: 0; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--tm-surface); border-radius: var(--tm-radius-sm); color: var(--tm-text); } .dark .ios-fullscreen-option-icon { background: var(--tm-surface); } .ios-fullscreen-option-recommended .ios-fullscreen-option-icon { background: var(--tm-text); color: var(--tm-accent-contrast); } /* 选项内容 */ .ios-fullscreen-option-content { flex: 1; } .ios-fullscreen-option-title { font-size: 16px; font-weight: 500; color: var(--tm-text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; } .dark .ios-fullscreen-option-title { color: var(--tm-text); } .ios-fullscreen-option-badge { display: inline-block; padding: 2px 8px; background: var(--tm-text); color: var(--tm-accent-contrast); font-size: 13px; font-weight: 500; border-radius: var(--tm-radius-sm); } .ios-fullscreen-option-desc { font-size: 13px; color: var(--tm-text); line-height: 1.4; } .dark .ios-fullscreen-option-desc { color: var(--tm-text); } /* 箭头图标 */ .ios-fullscreen-option-arrow { flex-shrink: 0; color: var(--tm-text); transition: transform 0.2s; } .dark .ios-fullscreen-option-arrow { color: var(--tm-text); } .ios-fullscreen-option:hover .ios-fullscreen-option-arrow { transform: translateX(4px); color: var(--tm-text); } /* 底部提示 */ .ios-fullscreen-dialog-footer { padding: 16px 24px; background: var(--tm-surface); border-top: 1px solid var(--tm-line); display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--tm-text); line-height: 1.5; } .dark .ios-fullscreen-dialog-footer { background: var(--tm-surface); border-top-color: var(--tm-line); color: var(--tm-text); } .ios-fullscreen-dialog-footer svg { flex-shrink: 0; margin-top: 2px; stroke: currentColor; } `;
                      document.head.appendChild(style);
                    },
                    click: function () {
                      if (!artPlayerRef.current) return;

                      // 检测是否在 PWA 模式下
                      const isPWA =
                        window.matchMedia('(display-mode: standalone)')
                          .matches ||
                        window.matchMedia('(display-mode: fullscreen)')
                          .matches ||
                        (window.navigator as any).standalone === true;

                      // 检查是否已经在原生全屏状态
                      const isInNativeFullscreen = !!(
                        document.fullscreenElement ||
                        (document as any).webkitFullscreenElement
                      );

                      // 如果已经在原生全屏状态，退出原生全屏
                      if (isInNativeFullscreen) {
                        const exitFullscreen =
                          (document as any).exitFullscreen ||
                          (document as any).webkitExitFullscreen ||
                          (document as any).mozCancelFullScreen ||
                          (document as any).msExitFullscreen;
                        if (exitFullscreen) {
                          try {
                            const result = exitFullscreen.call(document);
                            if (result && typeof result.catch === 'function') {
                              result.catch((err: Error) =>
                                console.error('退出全屏失败:', err)
                              );
                            }
                          } catch (err) {
                            console.error('退出全屏失败:', err);
                          }
                        }
                        return;
                      }

                      // 如果已经在网页全屏状态，退出网页全屏
                      if (artPlayerRef.current.fullscreenWeb) {
                        artPlayerRef.current.fullscreenWeb = false;
                        return;
                      }

                      // 如果在 PWA 模式下，直接使用容器全屏（可以隐藏状态栏）
                      if (isPWA) {
                        const container =
                          artPlayerRef.current.template.$container;
                        if (container && container.webkitEnterFullscreen) {
                          container
                            .webkitEnterFullscreen()
                            .catch((err: Error) => {
                              console.error('PWA 全屏失败:', err);
                              // 如果失败，降级使用网页全屏
                              artPlayerRef.current.fullscreenWeb = true;
                            });
                        } else {
                          // 不支持原生全屏，使用网页全屏
                          artPlayerRef.current.fullscreenWeb = true;
                        }
                        return;
                      }

                      // iPhone：直接用系统全屏（会自己横过来）。网页全屏在竖着的手机上只是中间一小条画面，
                      // 按钮还会被挤出屏幕（2026-11-18 问题文档第 6 条）。iPad 仍可以选
                      if (isHandheld()) {
                        const video = artPlayerRef.current.template
                          ?.$video as any;
                        if (video?.webkitEnterFullscreen)
                          video.webkitEnterFullscreen();
                        else if (video?.requestFullscreen)
                          void video.requestFullscreen();
                        else artPlayerRef.current.fullscreenWeb = true;
                        return;
                      }

                      // 非 PWA 模式：创建对话框（使用项目统一风格）
                      const dialog = document.createElement('div');
                      dialog.className = 'ios-fullscreen-dialog';
                      dialog.innerHTML = `
                <div class="ios-fullscreen-dialog-content">
                  <!-- 标题栏 -->
                  <div class="ios-fullscreen-dialog-header">
                    <h3 class="ios-fullscreen-dialog-title">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" stroke="currentColor" stroke-width="2" fill="none"/>
                      </svg>
                      选择全屏模式
                    </h3>
                    <p class="ios-fullscreen-dialog-subtitle">
                      由于 iOS 系统限制，原生全屏会使用系统播放器，将无法显示弹幕及使用部分播放器功能。网页全屏可能无法完全占满屏幕，但可保留所有功能。
                    </p>
                  </div>

                  <!-- 选项列表 -->
                  <div class="ios-fullscreen-dialog-options">
                    <!-- 网页全屏选项 -->
                    <button class="ios-fullscreen-option ios-fullscreen-option-recommended" data-action="web">
                      <div class="ios-fullscreen-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                          <path d="M7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" fill="currentColor"/>
                        </svg>
                      </div>
                      <div class="ios-fullscreen-option-content">
                        <div class="ios-fullscreen-option-title">
                          网页全屏
                          <span class="ios-fullscreen-option-badge">推荐</span>
                        </div>
                        <div class="ios-fullscreen-option-desc">
                          保留弹幕、控制栏等所有功能
                        </div>
                      </div>
                      <svg class="ios-fullscreen-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>

                    <!-- 原生全屏选项 -->
                    <button class="ios-fullscreen-option" data-action="native">
                      <div class="ios-fullscreen-option-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                      </div>
                      <div class="ios-fullscreen-option-content">
                        <div class="ios-fullscreen-option-title">
                          原生全屏
                        </div>
                        <div class="ios-fullscreen-option-desc">
                          使用系统播放器，部分功能不可用
                        </div>
                      </div>
                      <svg class="ios-fullscreen-option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>

                  <!-- 底部提示 -->
                  <div class="ios-fullscreen-dialog-footer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                      <path d="M12 16v-4m0-4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>将网站添加到主屏幕（PWA）后，网页全屏可以完全全屏</span>
                  </div>
                </div>
              `;

                      // 添加到页面
                      document.body.appendChild(dialog);

                      // 点击背景关闭
                      dialog.addEventListener('click', (e) => {
                        if (e.target === dialog) {
                          document.body.removeChild(dialog);
                        }
                      });

                      // 按钮点击事件
                      const buttons = dialog.querySelectorAll(
                        '.ios-fullscreen-option'
                      );
                      buttons.forEach((button) => {
                        button.addEventListener('click', () => {
                          const action = button.getAttribute('data-action');

                          if (action === 'web') {
                            // 网页全屏
                            if (artPlayerRef.current) {
                              artPlayerRef.current.fullscreenWeb = true;
                            }
                          } else if (action === 'native') {
                            // 原生全屏（尝试使用浏览器的全屏 API）
                            if (
                              artPlayerRef.current &&
                              artPlayerRef.current.template.$video
                            ) {
                              const videoElement =
                                artPlayerRef.current.template.$video;
                              if (videoElement.requestFullscreen) {
                                videoElement.requestFullscreen();
                              } else if (
                                (videoElement as any).webkitEnterFullscreen
                              ) {
                                (videoElement as any).webkitEnterFullscreen();
                              }
                            }
                          }

                          // 关闭对话框
                          document.body.removeChild(dialog);
                        });
                      });
                    },
                  },
                ]
              : []),
          ],
        });

        const wireInstance = (art: any) => {
          artPlayerRef.current = art;
          art.on('destroy', clearPlayerTimeouts);

          // 监听播放器事件
          artPlayerRef.current.on('ready', async () => {
            setError(null);

            // 换集重建前处于网页全屏则恢复，避免用户换集时被踢出全屏
            if (
              restoreWebFullscreenOnReadyRef.current &&
              artPlayerRef.current
            ) {
              restoreWebFullscreenOnReadyRef.current = false;
              try {
                artPlayerRef.current.fullscreenWeb = true;
              } catch (err) {
                console.warn('恢复网页全屏失败:', err);
              }
            }

            // 标记播放器已就绪，触发 usePlaySync 设置事件监听器
            setPlayerReady(true);
            console.log('[PlayPage] Player ready, triggering sync setup');

            // 控制截图按钮在小屏幕竖屏时隐藏
            const updateScreenshotVisibility = () => {
              const screenshotBtn = document.querySelector(
                '.art-control-screenshot'
              ) as HTMLElement;
              if (screenshotBtn) {
                screenshotBtn.style.display =
                  getDeviceTier() === 'phone' ? 'none' : '';
              }
            };
            updateScreenshotVisibility();
            window.addEventListener('resize', updateScreenshotVisibility);
            window.addEventListener(
              DEVICE_TIER_EVENT,
              updateScreenshotVisibility
            );
            artPlayerRef.current.on('fullscreen', updateScreenshotVisibility);
            artPlayerRef.current.on(
              'fullscreenWeb',
              updateScreenshotVisibility
            );

            // iOS 设备：动态调整弹幕设置面板位置，避免被遮挡
            if (isIOS && artPlayerRef.current) {
              // 使用 MutationObserver 监听弹幕设置面板的显示
              let isAdjusting = false; // 防止重复调整的标记
              const observer = new MutationObserver(() => {
                if (isAdjusting) return; // 如果正在调整，跳过

                const panel = document.querySelector(
                  '.apd-config-panel'
                ) as HTMLElement;
                if (panel && panel.style.display !== 'none') {
                  // 获取当前的 left 值
                  const currentLeft = parseInt(panel.style.left || '0', 10);

                  // 如果 left 值异常小（iOS 上只有 -5px），调整为正常值（-246px，比标准位置再往左 100px）
                  if (currentLeft > -50) {
                    isAdjusting = true; // 设置标记，防止重复触发
                    const adjustedLeft = -246;
                    panel.style.left = `${adjustedLeft}px`;
                    console.log(
                      '[iOS] 已调整弹幕设置面板位置: 从',
                      currentLeft,
                      '调整为',
                      adjustedLeft
                    );

                    // 延迟重置标记
                    setTimeout(() => {
                      isAdjusting = false;
                    }, 100);
                  }
                }
              });

              // 监听整个播放器容器的 DOM 变化
              if (artRef.current) {
                observer.observe(artRef.current, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['style', 'class'],
                });
              }

              // 清理函数
              artPlayerRef.current.on('destroy', () => {
                observer.disconnect();
              });
            }

            // 从 art.storage 读取弹幕设置并应用
            if (artPlayerRef.current) {
              const storedDanmakuSettings =
                artPlayerRef.current.storage.get('danmaku_settings');
              if (storedDanmakuSettings) {
                // 合并存储的设置到当前设置
                const mergedSettings = {
                  ...danmakuSettingsRef.current,
                  ...storedDanmakuSettings,
                };
                setDanmakuSettings(mergedSettings);
                saveDanmakuSettings(mergedSettings);
              }
            }

            // 保存弹幕插件引用
            if (artPlayerRef.current?.plugins?.artplayerPluginDanmuku) {
              danmakuPluginRef.current =
                artPlayerRef.current.plugins.artplayerPluginDanmuku;

              // 监听弹幕配置变化事件
              artPlayerRef.current.on('artplayerPluginDanmuku:config', () => {
                if (danmakuPluginRef.current?.option) {
                  const newSettings = {
                    ...danmakuSettingsRef.current,
                    opacity:
                      danmakuPluginRef.current.option.opacity ||
                      danmakuSettingsRef.current.opacity,
                    fontSize:
                      danmakuPluginRef.current.option.fontSize ||
                      danmakuSettingsRef.current.fontSize,
                    speed:
                      danmakuPluginRef.current.option.speed ||
                      danmakuSettingsRef.current.speed,
                    marginTop:
                      (danmakuPluginRef.current.option.margin &&
                        danmakuPluginRef.current.option.margin[0]) ??
                      danmakuSettingsRef.current.marginTop,
                    marginBottom:
                      (danmakuPluginRef.current.option.margin &&
                        danmakuPluginRef.current.option.margin[1]) ??
                      danmakuSettingsRef.current.marginBottom,
                  };

                  // 保存到 localStorage 和 art.storage
                  setDanmakuSettings(newSettings);
                  saveDanmakuSettings(newSettings);
                  if (artPlayerRef.current?.storage) {
                    artPlayerRef.current.storage.set(
                      'danmaku_settings',
                      newSettings
                    );
                  }

                  console.log('弹幕设置已更新并保存:', newSettings);
                }
              });

              // 自动加载弹幕（与剧集切换共用同一入口，内部有并发去重与插件就绪重试，
              // 避免换集重建播放器后重复搜索导致选择弹窗弹出两次）
              await loadDanmakuForEpisode(currentEpisodeIndexRef.current);

              if (artPlayerRef.current) {
                // 监听弹幕显示/隐藏事件，保存开关状态到 localStorage
                artPlayerRef.current.on('artplayerPluginDanmuku:show', () => {
                  danmakuDisplayStateRef.current = true;
                  saveDanmakuDisplayState(true);
                });

                artPlayerRef.current.on('artplayerPluginDanmuku:hide', () => {
                  danmakuDisplayStateRef.current = false;
                  saveDanmakuDisplayState(false);
                });
              }
            }
          });

          artPlayerRef.current.on('pause', () => {
            saveCurrentPlayProgress();
          });

          artPlayerRef.current.on('video:volumechange', () => {
            lastVolumeRef.current = artPlayerRef.current.volume;
          });
          // 监听网页全屏事件，控制导航栏显示隐藏
          artPlayerRef.current.on('fullscreenWeb', (isFullscreen: boolean) => {
            console.log('网页全屏状态变化:', isFullscreen);
            setIsWebFullscreen(isFullscreen);
          });

          // 触屏：画面正中快退 / 播放暂停 / 快进，手机全屏左上退出。和房间播放器共用一份
          // （src/lib/player-touch-controls.ts）；以前这里自己写了一套，位置、样子都和房间不一样
          {
            const art = artPlayerRef.current;
            const disposeTouch = installTouchControls(art, {
              stepSeconds: () => seekStepSecondsRef.current,
              exitFullscreen: () => {
                if (document.fullscreenElement)
                  void document.exitFullscreen().catch(() => undefined);
                if (art.fullscreenWeb) art.fullscreenWeb = false;
                if (art.fullscreen) art.fullscreen = false;
              },
            });
            art.on('destroy', disposeTouch);
          }

          // 监听视频可播放事件，这时恢复播放进度更可靠
          artPlayerRef.current.on('video:canplay', () => {
            // 若存在需要恢复的播放进度，则跳转
            if (resumeTimeRef.current && resumeTimeRef.current > 0) {
              try {
                const duration = artPlayerRef.current.duration || 0;
                let target = resumeTimeRef.current;
                if (duration && target >= duration - 2) {
                  target = Math.max(0, duration - 5);
                }
                artPlayerRef.current.currentTime = target;
                console.log('成功恢复播放进度到:', resumeTimeRef.current);
              } catch (err) {
                console.warn('恢复播放进度失败:', err);
              }
            }
            resumeTimeRef.current = null;

            const shouldResumePlaying =
              resumePlayingAfterHlsModeSwitchRef.current;
            resumePlayingAfterHlsModeSwitchRef.current = null;
            if (shouldResumePlaying === false) {
              artPlayerRef.current.pause();
            } else if (shouldResumePlaying === true) {
              Promise.resolve(artPlayerRef.current.play()).catch((error) => {
                console.warn('[Harmony HLS] 恢复播放失败:', error);
              });
            }

            schedulePlayerTimeout(() => {
              if (!artPlayerRef.current) {
                return;
              }

              if (
                Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) >
                0.01
              ) {
                artPlayerRef.current.volume = lastVolumeRef.current;
              }
              artPlayerRef.current.notice.show = '';
            }, 0);

            // 隐藏换源加载状态
            setIsVideoLoading(false);
            setVideoError(null);
            setCorsFailedUrl(null);
          });

          // 监听视频播放事件，检查是否需要显示播放记录跳转按钮
          artPlayerRef.current.on('video:playing', () => {
            // 检查是否需要显示播放记录跳转按钮
            // 条件：当前播放时间 < 10秒 且 播放记录时间 > 10秒
            const checkPlayRecordJump = async () => {
              try {
                // 短剧不显示"上次播放到"提示（短剧单集太短，提示意义不大）
                if (searchParams.get('duanju') === '1') {
                  playRecordJumpInitialCheckRef.current = false;
                  return;
                }

                // 仅在进入播放后的首次检查时处理，避免本次会话新生成的记录触发恢复按钮
                if (!playRecordJumpInitialCheckRef.current) {
                  return;
                }

                // 如果用户已经关闭过跳转按钮，不再显示
                if (playRecordJumpDismissedRef.current) {
                  return;
                }

                const currentTime = artPlayerRef.current?.currentTime || 0;

                // 如果当前播放时间已经大于等于10秒，不显示跳转按钮
                if (currentTime >= 10) {
                  // 标记已经进行过首次检查，避免切集后再显示
                  playRecordJumpInitialCheckRef.current = false;
                  if (playRecordJumpLayerRef.current) {
                    artPlayerRef.current.layers.remove('play-record-jump');
                    playRecordJumpLayerRef.current = null;
                  }
                  return;
                }

                // 获取播放记录
                const allRecords = await getAllPlayRecords();
                const key = generateStorageKey(
                  currentSourceRef.current,
                  currentIdRef.current
                );
                const record = allRecords[key];

                if (record) {
                  const recordIndex = record.index - 1;
                  const recordTime = record.play_time;

                  // 检查是否是当前集数且播放记录时间大于10秒且当前时间小于10秒
                  if (
                    recordIndex === currentEpisodeIndexRef.current &&
                    recordTime > 10 &&
                    currentTime < 10
                  ) {
                    // 如果已经添加过，不重复添加
                    if (playRecordJumpLayerRef.current) {
                      return;
                    }

                    // 标记已经进行过首次检查
                    playRecordJumpInitialCheckRef.current = false;

                    // 格式化时间显示
                    const formatTime = (seconds: number): string => {
                      const h = Math.floor(seconds / 3600);
                      const m = Math.floor((seconds % 3600) / 60);
                      const s = Math.floor(seconds % 60);
                      if (h > 0) {
                        return `${h}:${m.toString().padStart(2, '0')}:${s
                          .toString()
                          .padStart(2, '0')}`;
                      }
                      return `${m}:${s.toString().padStart(2, '0')}`;
                    };

                    // 添加到播放器 layers
                    playRecordJumpLayerRef.current =
                      artPlayerRef.current.layers.add({
                        name: 'play-record-jump',
                        html: `
                      <div id="play-record-jump-container" style="
                        position: absolute;
                        left: 16px;
                        bottom: 60px;
                        z-index: 20;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 12px;
                        background-color: color-mix(in srgb, var(--tm-room-cinema-bg) 55%, transparent);
                        border-radius: var(--tm-radius-sm);
                        color: var(--tm-text);
                        font-size: 14px;
                        font-family: system-ui, -apple-system, sans-serif;
                        box-shadow: 0 2px 8px var(--tm-room-cinema-bg);
                        backdrop-filter: blur(4px);
                        pointer-events: auto;
                      ">
                        <span style="margin-right: 4px;">
                          上次播放到 ${formatTime(recordTime)}
                        </span>
                        <button id="play-record-jump-btn" style="
                          padding: 4px 12px;
                          background-color: color-mix(in srgb, var(--tm-room-cinema-bg) 55%, transparent);
                          border: 1px solid var(--tm-line);
                          border-radius: var(--tm-radius-sm);
                          color: var(--tm-text);
                          font-size: 13px;
                          cursor: pointer;
                          transition: all 0.2s;
                          font-weight: 500;
                        ">
                          跳转
                        </button>
                        <button id="play-record-dismiss-btn" style="
                          padding: 4px 8px;
                          background-color: transparent;
                          border: none;
                          color: var(--tm-text);
                          font-size: 18px;
                          cursor: pointer;
                          line-height: 1;
                          transition: color 0.2s;
                        " title="关闭">
                          ×
                        </button>
                      </div>
                    `,
                        style: {
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                        },
                      });

                    // 绑定事件
                    const jumpBtn = document.getElementById(
                      'play-record-jump-btn'
                    );
                    const dismissBtn = document.getElementById(
                      'play-record-dismiss-btn'
                    );

                    if (jumpBtn) {
                      jumpBtn.addEventListener('mouseenter', () => {
                        jumpBtn.style.backgroundColor =
                          'rgba(255, 255, 255, 0.3)';
                      });
                      jumpBtn.addEventListener('mouseleave', () => {
                        jumpBtn.style.backgroundColor =
                          'rgba(255, 255, 255, 0.2)';
                      });
                      jumpBtn.addEventListener('click', () => {
                        if (artPlayerRef.current) {
                          artPlayerRef.current.currentTime = recordTime;
                          artPlayerRef.current.notice.show = `已跳转到 ${formatTime(
                            recordTime
                          )}`;
                        }
                        playRecordJumpDismissedRef.current = true;
                        if (playRecordJumpLayerRef.current) {
                          artPlayerRef.current.layers.remove(
                            'play-record-jump'
                          );
                          playRecordJumpLayerRef.current = null;
                        }
                      });
                    }

                    if (dismissBtn) {
                      dismissBtn.addEventListener('mouseenter', () => {
                        dismissBtn.style.color = 'white';
                      });
                      dismissBtn.addEventListener('mouseleave', () => {
                        dismissBtn.style.color = 'rgba(255, 255, 255, 0.7)';
                      });
                      dismissBtn.addEventListener('click', () => {
                        playRecordJumpDismissedRef.current = true;
                        if (playRecordJumpLayerRef.current) {
                          artPlayerRef.current.layers.remove(
                            'play-record-jump'
                          );
                          playRecordJumpLayerRef.current = null;
                        }
                      });
                    }

                    console.log(
                      '[PlayRecordJump] 显示跳转按钮，当前时间:',
                      currentTime,
                      '记录时间:',
                      recordTime
                    );
                  } else {
                    // 不满足显示条件，也标记为已检查过
                    playRecordJumpInitialCheckRef.current = false;
                  }
                } else {
                  // 没有播放记录，也标记为已检查过
                  playRecordJumpInitialCheckRef.current = false;
                }
              } catch (err) {
                console.error('[PlayRecordJump] 检查播放记录失败:', err);
                // 即使出错也标记为已检查过
                playRecordJumpInitialCheckRef.current = false;
              }
            };

            // 延迟检查，确保播放器已经稳定
            setTimeout(checkPlayRecordJump, 500);
          });

          // 监听视频时间更新事件，实现跳过片头片尾
          artPlayerRef.current.on('video:timeupdate', () => {
            if (!skipConfigRef.current.enable) return;

            const currentTime = artPlayerRef.current.currentTime || 0;
            const duration = artPlayerRef.current.duration || 0;
            const now = Date.now();

            // 限制跳过检查频率为1.5秒一次
            if (now - lastSkipCheckRef.current < 1500) return;
            lastSkipCheckRef.current = now;

            // 跳过片头
            if (
              skipConfigRef.current.intro_time > 0 &&
              currentTime < skipConfigRef.current.intro_time
            ) {
              artPlayerRef.current.currentTime =
                skipConfigRef.current.intro_time;
              artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(
                skipConfigRef.current.intro_time
              )})`;
            }

            // 跳过片尾
            if (
              skipConfigRef.current.outro_time < 0 &&
              duration > 0 &&
              currentTime >
                artPlayerRef.current.duration + skipConfigRef.current.outro_time
            ) {
              if (
                currentEpisodeIndexRef.current <
                (detailRef.current?.episodes?.length || 1) - 1
              ) {
                handleNextEpisode();
              } else {
                artPlayerRef.current.pause();
              }
              artPlayerRef.current.notice.show = `已跳过片尾 (${formatTime(
                skipConfigRef.current.outro_time
              )})`;
            }
          });

          // 监听视频播放结束事件，自动播放下一集
          artPlayerRef.current.on('video:ended', () => {
            const d = detailRef.current;
            const idx = currentEpisodeIndexRef.current;

            if (!d || !d.episodes || idx >= d.episodes.length - 1) {
              return;
            }

            // 查找下一个未被过滤的集数
            let nextIdx = idx + 1;
            while (nextIdx < d.episodes.length) {
              const episodeTitle = d.episodes_titles?.[nextIdx];
              const isFiltered =
                episodeTitle && isEpisodeFilteredByTitle(episodeTitle);

              if (!isFiltered) {
                setTimeout(() => {
                  setCurrentEpisodeIndex(nextIdx);
                }, 1000);
                return;
              }
              nextIdx++;
            }

            // 所有后续集数都被屏蔽
            if (artPlayerRef.current) {
              artPlayerRef.current.notice.show = '后续集数均已屏蔽，已自动停止';
            }
          });

          artPlayerRef.current.on('video:timeupdate', () => {
            const now = Date.now();
            let interval = 5000;
            if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
              interval = 20000;
            }
            if (now - lastSaveTimeRef.current > interval) {
              saveCurrentPlayProgress();
              lastSaveTimeRef.current = now;
            }

            // 下集预缓冲逻辑
            const nextEpisodePreCacheEnabled =
              typeof window !== 'undefined'
                ? localStorage.getItem('nextEpisodePreCache') === 'true'
                : false;

            if (nextEpisodePreCacheEnabled) {
              const currentTime = artPlayerRef.current?.currentTime || 0;
              const duration = artPlayerRef.current?.duration || 0;
              const progress = duration > 0 ? currentTime / duration : 0;

              // 检查是否已经到达90%播放进度
              if (
                duration > 0 &&
                progress >= 0.9 &&
                !nextEpisodePreCacheTriggeredRef.current
              ) {
                // 标记已触发，防止重复执行
                nextEpisodePreCacheTriggeredRef.current = true;

                // 获取下一集信息
                const currentIdx = currentEpisodeIndexRef.current;
                const episodes = detailRef.current?.episodes;

                if (!episodes || currentIdx >= episodes.length - 1) {
                  return;
                }

                const nextEpisodeIndex = currentIdx + 1;
                const nextEpisodeUrl = episodes[nextEpisodeIndex];

                if (!nextEpisodeUrl) {
                  return;
                }

                // 使用 fetch 预加载资源，利用浏览器缓存
                const preloadNextEpisode = async () => {
                  try {
                    // 判断是否是m3u8流
                    if (
                      nextEpisodeUrl.includes('.m3u8') ||
                      nextEpisodeUrl.includes('m3u8')
                    ) {
                      // 1. 先fetch m3u8文件
                      const m3u8Response = await fetch(nextEpisodeUrl);
                      const m3u8Text = await m3u8Response.text();

                      // 2. 解析m3u8，提取ts分片URL
                      const lines = m3u8Text.split('\n');
                      const tsUrls: string[] = [];
                      const baseUrl = nextEpisodeUrl.substring(
                        0,
                        nextEpisodeUrl.lastIndexOf('/') + 1
                      );

                      for (const line of lines) {
                        const trimmedLine = line.trim();
                        // 跳过注释和空行
                        if (!trimmedLine || trimmedLine.startsWith('#')) {
                          continue;
                        }
                        // 构建完整的ts URL
                        const tsUrl = trimmedLine.startsWith('http')
                          ? trimmedLine
                          : baseUrl + trimmedLine;
                        tsUrls.push(tsUrl);
                      }

                      // 3. 预加载前20个ts分片
                      const maxFragmentsToPreload = Math.min(20, tsUrls.length);

                      for (let i = 0; i < maxFragmentsToPreload; i++) {
                        try {
                          await fetch(tsUrls[i]);
                        } catch (err) {
                          // 静默处理分片加载失败
                        }
                      }
                    }
                  } catch (error) {
                    // 静默处理预缓冲失败
                  }
                };

                // 异步执行预缓冲
                preloadNextEpisode();
              }
            }

            // 下集弹幕预加载逻辑
            const nextEpisodeDanmakuPreloadEnabled =
              typeof window !== 'undefined'
                ? localStorage.getItem('nextEpisodeDanmakuPreload') === 'true'
                : false;

            if (nextEpisodeDanmakuPreloadEnabled) {
              const currentTime = artPlayerRef.current?.currentTime || 0;
              const duration = artPlayerRef.current?.duration || 0;
              const progress = duration > 0 ? currentTime / duration : 0;

              // 检查是否已经到达90%播放进度
              if (
                duration > 0 &&
                progress >= 0.9 &&
                !nextEpisodeDanmakuPreloadTriggeredRef.current
              ) {
                // 标记已触发，防止重复执行
                nextEpisodeDanmakuPreloadTriggeredRef.current = true;

                // 异步执行弹幕预加载
                preloadNextEpisodeDanmaku();
              }
            }
          });
        };

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
  }, [
    videoUrl,
    loading,
    blockAdEnabled,
    harmonyHlsPlaybackMode,
    nativeHlsAdBlockEnabled,
    netdiskHlsPlaybackMode,
  ]);

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
      {showDanmakuSourceSelector && danmakuMatches.length > 0 && (
        <DanmakuSourceDialog
          matches={danmakuMatches}
          onSelect={(anime, index) =>
            void handleDanmakuSourceSelect(anime, index)
          }
          onCancel={() => {
            setShowDanmakuSourceSelector(false);
            setDanmakuMatches([]);
          }}
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
                  danmakuLoading={danmakuLoading}
                  danmakuCount={danmakuCount}
                  danmakuOriginalCount={danmakuOriginalCount}
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
                  handleDanmakuSelect(selection, true)
                }
                onDanmakuEpisodesLoaded={applyDanmakuEpisodes}
                currentDanmakuSelection={currentDanmakuSelection}
                onUploadDanmaku={handleUploadDanmaku}
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
          danmakuCount={danmakuCount}
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
          setDanmakuFilterConfig(config);
          danmakuFilterConfigRef.current = config;

          // 重新加载弹幕以应用新的过滤规则
          if (danmakuPluginRef.current) {
            try {
              danmakuPluginRef.current.load();
              console.log('弹幕过滤规则已更新，重新加载弹幕');
            } catch (error) {
              console.error('重新加载弹幕失败:', error);
            }
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

// 从 localStorage 读取小雅源的纠错信息
const getXiaoyaCorrection = (source: string, id: string) => {
  try {
    const storageKey = `xiaoya_correction_${source}_${id}`;
    const correctionJson = localStorage.getItem(storageKey);
    if (correctionJson) {
      return JSON.parse(correctionJson);
    }
  } catch (error) {
    console.error('读取纠错信息失败:', error);
  }
  return null;
};

// 应用纠错信息到 detail 对象
const applyCorrection = (
  detail: SearchResult,
  correction: any
): SearchResult => {
  return {
    ...detail,
    title: correction.title || detail.title,
    poster: correction.posterPath
      ? processImageUrl(getTMDBImageUrl(correction.posterPath))
      : detail.poster,
    year: correction.releaseDate || detail.year,
    desc: correction.overview || detail.desc,
    rating: correction.voteAverage || detail.rating,
    tmdb_id: correction.tmdbId || detail.tmdb_id,
    douban_id: correction.doubanId
      ? typeof correction.doubanId === 'string'
        ? parseInt(correction.doubanId, 10)
        : correction.doubanId
      : detail.douban_id,
    type_name:
      correction.mediaType === 'movie'
        ? '电影'
        : correction.mediaType === 'tv'
        ? '电视剧'
        : detail.type_name,
  };
};

// 批量应用纠错信息到源列表
const applyCorrectionsToSources = (sources: SearchResult[]): SearchResult[] => {
  return sources.map((source) => {
    if (source.source === 'xiaoya') {
      const correction = getXiaoyaCorrection(source.source, source.id);
      if (correction) {
        return applyCorrection(source, correction);
      }
    }
    return source;
  });
};

export default function PlayPage() {
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
