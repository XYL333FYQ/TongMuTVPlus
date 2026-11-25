'use client';

/*
 * 影片卡片的基础状态：要显示的标题 / 海报 / 年份 / 来源、直链、收藏状态、AI 开关、海报备源。参数就是 VideoCardProps。
 */

import { useRouter } from 'next/navigation';
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isAnimeCategoryText } from '@/lib/anime-keyword-expr';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  generateStorageKey,
  isFavorited,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { isNetdiskSource } from '@/lib/netdisk/source';
import { isPrivilegedRole } from '@/lib/roles';
import type { TMDBVideoItem } from '@/lib/tmdb.client';
import {
  base58Decode,
  ensureBangumiImagePrimaryProbed,
  getBangumiImageFallbackUrl,
  processImageUrl,
} from '@/lib/utils';
import { usePlaybackSessionSafe } from '@/hooks/usePlaybackSession';

import { preloadAIChatPanel } from '@/components/AIChatPanel.lazy';
import { useExternalAction } from '@/components/ExternalLink';

import type { VideoCardHandle, VideoCardProps } from '../VideoCard';

export function useVideoCardBase(
  {
    id,
    title = '',
    query = '',
    poster = '',
    episodes,
    source,
    source_name,
    source_names,
    progress = 0,
    year,
    from,
    currentEpisode,
    douban_id,
    tmdb_id,
    onDelete,
    rate,
    type = '',
    isBangumi = false,
    isAnime = false,
    typeName,
    isAggregate = false,
    origin = 'vod',
    releaseDate,
    isUpcoming = false,
    seasonNumber,
    seasonName,
    orientation = 'vertical',
    compact = false,
    playTime,
    totalTime,
    cmsData,
    onBeforeNavigate,
    detailOnTouch = false,
    isDuanju,
  }: VideoCardProps,
  ref: React.ForwardedRef<VideoCardHandle>
) {
  const router = useRouter();
  const requestPlayback = usePlaybackSessionSafe()?.requestPlayback;
  const [showAnimeSubscribe, setShowAnimeSubscribe] = useState(false);
  const [animeSubscribeToast, setAnimeSubscribeToast] = useState('');
  const isAdminUser = useMemo(() => {
    const auth = getAuthInfoFromBrowserCookie();
    return isPrivilegedRole(auth?.role);
  }, []);
  const resolvedIsAnime = useMemo(
    () => Boolean(isBangumi || isAnime || isAnimeCategoryText(typeName)),
    [isBangumi, isAnime, typeName]
  );
  const actualTitle = title;
  const compactRecord =
    compact && from === 'playrecord' && orientation === 'horizontal';
  const actualPoster = poster;
  const netdiskPosterPlaceholder = '/icons/netdisk-placeholder.svg';
  const processedPoster = useMemo(
    () =>
      actualPoster
        ? processImageUrl(actualPoster)
        : isNetdiskSource(source)
        ? netdiskPosterPlaceholder
        : '',
    [actualPoster, source, netdiskPosterPlaceholder]
  );
  const [favorited, setFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const externalAction = useExternalAction();
  const { open: openExternal, mode: externalMode } = externalAction;
  const [searchFavorited, setSearchFavorited] = useState<boolean | null>(null); // 搜索结果的收藏状态
  const [showAIChat, setShowAIChat] = useState(false);
  const [isAIStreaming, setIsAIStreaming] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDefaultMessageWithVideo, setAiDefaultMessageWithVideo] =
    useState('');
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const detailTriggerRef = useRef<HTMLDivElement>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showUpcomingInfo, setShowUpcomingInfo] = useState(false); // 控制即将上映倒计时的显示
  const [showTrailerPicker, setShowTrailerPicker] = useState(false);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState<string | null>(null);
  const [trailerVideos, setTrailerVideos] = useState<TMDBVideoItem[]>([]);
  const [displayPoster, setDisplayPoster] = useState(processedPoster);

  // 检查AI功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        window.RUNTIME_CONFIG?.AI_ENABLED &&
        window.RUNTIME_CONFIG?.AI_ENABLE_VIDEOCARD_ENTRY;
      setAiEnabled(Boolean(enabled));
      // 开了 AI 才在空闲时预载问片面板代码
      if (enabled) preloadAIChatPanel();

      // 加载AI默认消息配置
      const defaultMsg = window.RUNTIME_CONFIG?.AI_DEFAULT_MESSAGE_WITH_VIDEO;
      if (defaultMsg) {
        setAiDefaultMessageWithVideo(defaultMsg);
      }
    }
  }, []);

  // 可外部修改的可控字段
  const [dynamicEpisodes, setDynamicEpisodes] = useState<number | undefined>(
    episodes
  );
  const [dynamicSourceNames, setDynamicSourceNames] = useState<
    string[] | undefined
  >(source_names);
  const [dynamicDoubanId, setDynamicDoubanId] = useState<number | undefined>(
    douban_id
  );

  useEffect(() => {
    setDynamicEpisodes(episodes);
  }, [episodes]);

  useEffect(() => {
    setDynamicSourceNames(source_names);
  }, [source_names]);

  useEffect(() => {
    setDynamicDoubanId(douban_id);
  }, [douban_id]);

  useEffect(() => {
    setDisplayPoster(processedPoster);
  }, [processedPoster]);

  // 主源图片域主页探测：失败写 sticky 后切备源海报（替代原 5s 强制降级）
  useEffect(() => {
    if (!actualPoster) return;

    let cancelled = false;
    void (async () => {
      const reachable = await ensureBangumiImagePrimaryProbed();
      if (cancelled || reachable) return;
      const bangumiFallbackPoster = getBangumiImageFallbackUrl(actualPoster);
      if (bangumiFallbackPoster) {
        setDisplayPoster(bangumiFallbackPoster);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actualPoster]);

  useImperativeHandle(ref, () => ({
    setEpisodes: (eps?: number) => setDynamicEpisodes(eps),
    setSourceNames: (names?: string[]) => setDynamicSourceNames(names),
    setDoubanId: (id?: number) => setDynamicDoubanId(id),
  }));

  const actualSource = source;
  const actualId = id;
  const actualDoubanId = dynamicDoubanId;
  const actualEpisodes = dynamicEpisodes;
  const actualYear = year;
  const actualQuery = query || '';
  const actualSearchType = type;
  const isDirectPlaySource = actualSource === 'directplay';
  const directLinkUrl = useMemo(() => {
    if (!isDirectPlaySource || !actualId) return '';
    try {
      return base58Decode(actualId);
    } catch {
      return '';
    }
  }, [isDirectPlaySource, actualId]);
  const displayYear = useMemo(() => {
    if (!actualYear) return '';
    const normalized = actualYear.trim();
    if (!normalized || normalized === 'unknown') return '';
    const digits = normalized.replace(/\D/g, '');
    if (!digits) return normalized;
    return digits.slice(-2).padStart(2, '0');
  }, [actualYear]);

  // 获取收藏状态（搜索结果页面不检查）
  useEffect(() => {
    if (from === 'douban' || from === 'search' || !actualSource || !actualId)
      return;

    const fetchFavoriteStatus = async () => {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setFavorited(fav);
      } catch (err) {
        throw new Error('检查收藏状态失败');
      }
    };

    fetchFavoriteStatus();

    // 监听收藏状态更新事件
    const storageKey = generateStorageKey(actualSource, actualId);
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, unknown>) => {
        // 检查当前项目是否在新的收藏列表中
        const isNowFavorited = !!newFavorites[storageKey];
        setFavorited(isNowFavorited);
      }
    );

    return unsubscribe;
  }, [from, actualSource, actualId]);

  return {
    id,
    title,
    query,
    poster,
    episodes,
    source,
    source_name,
    source_names,
    progress,
    year,
    from,
    currentEpisode,
    douban_id,
    tmdb_id,
    onDelete,
    rate,
    type,
    isBangumi,
    isAnime,
    typeName,
    isAggregate,
    origin,
    releaseDate,
    isUpcoming,
    seasonNumber,
    seasonName,
    orientation,
    compact,
    playTime,
    totalTime,
    cmsData,
    onBeforeNavigate,
    detailOnTouch,
    isDuanju,
    ref,
    router,
    requestPlayback,
    showAnimeSubscribe,
    setShowAnimeSubscribe,
    animeSubscribeToast,
    setAnimeSubscribeToast,
    isAdminUser,
    resolvedIsAnime,
    actualTitle,
    compactRecord,
    actualPoster,
    netdiskPosterPlaceholder,
    processedPoster,
    favorited,
    setFavorited,
    isLoading,
    setIsLoading,
    showMobileActions,
    setShowMobileActions,
    externalAction,
    openExternal,
    externalMode,
    searchFavorited,
    setSearchFavorited,
    showAIChat,
    setShowAIChat,
    isAIStreaming,
    setIsAIStreaming,
    aiEnabled,
    setAiEnabled,
    aiDefaultMessageWithVideo,
    setAiDefaultMessageWithVideo,
    showDetailPanel,
    setShowDetailPanel,
    detailTriggerRef,
    showImageViewer,
    setShowImageViewer,
    showUpcomingInfo,
    setShowUpcomingInfo,
    showTrailerPicker,
    setShowTrailerPicker,
    trailerLoading,
    setTrailerLoading,
    trailerError,
    setTrailerError,
    trailerVideos,
    setTrailerVideos,
    displayPoster,
    setDisplayPoster,
    dynamicEpisodes,
    setDynamicEpisodes,
    dynamicSourceNames,
    setDynamicSourceNames,
    dynamicDoubanId,
    setDynamicDoubanId,
    actualSource,
    actualId,
    actualDoubanId,
    actualEpisodes,
    actualYear,
    actualQuery,
    actualSearchType,
    isDirectPlaySource,
    directLinkUrl,
    displayYear,
  };
}

export type VideoCardBase = ReturnType<typeof useVideoCardBase>;
