'use client';

/*
 * 播放页状态（一）：播放会话、加载阶段和文案、影片基本信息、TMDB 背景与分集名、面板模式、网页全屏、弹幕控制器。
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import type { EpisodeTitleCorrection } from '@/lib/episode-title-correction';
import { isPrivilegedRole } from '@/lib/roles';
import { readSetting } from '@/lib/settings';
import { SearchResult } from '@/lib/types';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { useEnableAIComments } from '@/hooks/useEnableAIComments';
import { useEnableComments } from '@/hooks/useEnableComments';
import {
  usePlaybackSearchParams,
  usePlaybackSession,
} from '@/hooks/usePlaybackSession';

import { notify } from '@/components/feedback/AppDialogs';
import { useSite } from '@/components/SiteProvider';

import { useDownload } from '@/contexts/DownloadContext';
import {
  type Art,
  type DanmakuState,
  Anime4KController,
  DanmakuController,
  LinkRefresher,
} from '@/features/player';

import { useFilterConfigs } from '../useFilterConfigs';
import { usePlaybackFeatureFlags } from '../usePlaybackFeatureFlags';
import { usePlayerPreferences } from '../usePlayerPreferences';
import { usePlaybackDrawers } from '../../page/PlaybackDrawers';
import type { ShowToast } from '../../page/types';

export function usePlaybackSession0() {
  const artPlayerRef = useRef<Art | null>(null);
  const linkRefresherRef = useRef<LinkRefresher | null>(null);
  const LOCAL_TRANSCODER_BASE_URL = 'http://localhost:19080' as const;
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
    // 续期器在第一次渲染时就建好、之后不换，这里先拿住
    const refresher = linkRefresherRef.current;
    return () => {
      refresher?.clear();
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

  return {
    artPlayerRef,
    linkRefresherRef,
    LOCAL_TRANSCODER_BASE_URL,
    router,
    searchParams,
    playbackSession,
    reportMedia,
    attachController,
    setMetadata,
    reloadPlayback,
    surfaceActiveRef,
    commitPlaybackHref,
    enableComments,
    enableAIComments,
    addDownloadTask,
    siteName,
    authInfo,
    enableOfflineDownload,
    hasOfflinePermission,
    loading,
    setLoading,
    loadingStage,
    setLoadingStage,
    loadingMessage,
    setLoadingMessage,
    initialLoadParams,
    error,
    setError,
    detail,
    setDetail,
    tmdbBackdrop,
    setTmdbBackdrop,
    tmdbEpisodeNames,
    setTmdbEpisodeNames,
    resolvedTmdbIdStr,
    setResolvedTmdbIdStr,
    tmdbEpisodesFetchedIdRef,
    globalTitleFetchDisabled,
    titleCorrection,
    setTitleCorrection,
    netdiskSearchEnabled,
    aiEnabled,
    aiDefaultMessageWithVideo,
    showShortcutDialog,
    setShowShortcutDialog,
    isLargeScreen,
    drawers,
    openDrawer,
    isWebFullscreen,
    setIsWebFullscreen,
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
    lastSkipCheckRef,
    anime4kRef,
    anime4k,
    danmaku,
    danmakuState,
    setDanmakuState,
    episodeFilterConfig,
    setEpisodeFilterConfig,
    episodeFilterConfigRef,
    showDanmakuFilterSettings,
    setShowDanmakuFilterSettings,
    showToast,
    isTranscoding,
    setIsTranscoding,
    videoTitle,
    setVideoTitle,
    videoYear,
    setVideoYear,
    videoCover,
    setVideoCover,
    videoDoubanId,
    setVideoDoubanId,
  };
}

export type PlaybackSession0 = ReturnType<typeof usePlaybackSession0>;
