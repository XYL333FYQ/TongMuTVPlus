import {
  Cloud,
  Heart,
  Link,
  Play,
  PlayCircleIcon,
  Radio,
  Star,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import './VideoCard.css';

import { isAnimeCategoryText } from '@/lib/anime-keyword-expr';
import { apiFetch } from '@/lib/api-client';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { getBangumiSubjectUrl } from '@/lib/bangumi.client';
import {
  deleteFavorite,
  deletePlayRecord,
  generateStorageKey,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { matchesMedia } from '@/lib/device-tier';
import { posterTiltHandlers } from '@/lib/motion';
import { isNetdiskSource } from '@/lib/netdisk/source';
import {
  filmPlaybackHref,
  queuePlaybackHref,
  roomSelectionHref,
} from '@/lib/playback-links';
import { isPrivilegedRole } from '@/lib/roles';
import { appendSpecialSourceParam } from '@/lib/special-source.client';
import { formatDuration } from '@/lib/time';
import type { TMDBVideoItem } from '@/lib/tmdb.client';
import {
  base58Decode,
  clearBangumiImageFallbackCacheIfFailed,
  ensureBangumiImagePrimaryProbed,
  getBangumiImageFallbackUrl,
  getDoubanImageFallbackUrl,
  processImageUrl,
  tryApplyBangumiImageFallback,
  tryApplyDoubanImageFallback,
} from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import { usePlaybackSessionSafe } from '@/hooks/usePlaybackSession';

import AIChatPanel, { preloadAIChatPanel } from '@/components/AIChatPanel.lazy';
import AnimeSubscribeModal from '@/components/AnimeSubscribeModal';
import DetailPanel from '@/components/DetailPanel';
import { useExternalAction } from '@/components/ExternalLink';
import ImageViewer from '@/components/feedback/ImageViewer';
import MobileActionSheet from '@/components/feedback/MobileActionSheet';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import TrailerPickerDialog from '@/components/TrailerPickerDialog';

import { cardConfig } from './video-card/card-config';
import { buildMobileActions } from './video-card/mobile-actions';

export interface VideoCardProps {
  id?: string;
  source?: string;
  title?: string;
  query?: string;
  poster?: string;
  episodes?: number;
  source_name?: string;
  source_names?: string[];
  progress?: number;
  year?: string;
  from:
    | 'playrecord'
    | 'favorite'
    | 'search'
    | 'douban'
    | 'tmdb'
    | 'source-search';
  currentEpisode?: number;
  douban_id?: number;
  tmdb_id?: number;
  onDelete?: () => void;
  rate?: string;
  type?: string;
  isBangumi?: boolean;
  /** 明确标记为动漫（豆瓣动漫页 / CMS 等） */
  isAnime?: boolean;
  /** CMS 分类名，用于启发式识别动漫 */
  typeName?: string;
  isAggregate?: boolean;
  origin?: 'vod' | 'live';
  releaseDate?: string; // 上映日期，格式：YYYY-MM-DD
  isUpcoming?: boolean; // 是否为即将上映
  seasonNumber?: number; // 季度编号
  seasonName?: string; // 季度名称
  orientation?: 'vertical' | 'horizontal'; // 卡片方向
  compact?: boolean; // 首页记录的紧凑排版，沿用原卡片的全部操作
  playTime?: number; // 当前播放时间（秒）
  totalTime?: number; // 总时长（秒）
  cmsData?: {
    desc?: string;
    episodes?: string[];
    episodes_titles?: string[];
  };
  onBeforeNavigate?: () => void;
  detailOnTouch?: boolean;
  isDuanju?: boolean; // 短剧标识，用于播放页跳过"上次播放到"提示
}

export type VideoCardHandle = {
  setEpisodes: (episodes?: number) => void;
  setSourceNames: (names?: string[]) => void;
  setDoubanId: (id?: number) => void;
};

const VideoCard = forwardRef<VideoCardHandle, VideoCardProps>(
  function VideoCard(
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
    ref
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
    const [searchFavorited, setSearchFavorited] = useState<boolean | null>(
      null
    ); // 搜索结果的收藏状态
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
        setAiEnabled(enabled);
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

    const handleToggleFavorite = useCallback(
      async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        if (from === 'douban' || !actualSource || !actualId) return;

        try {
          // 确定当前收藏状态
          const currentFavorited =
            from === 'search' ? searchFavorited : favorited;

          if (currentFavorited) {
            // 如果已收藏，删除收藏
            await deleteFavorite(actualSource, actualId);
            if (from === 'search') {
              setSearchFavorited(false);
            } else {
              setFavorited(false);
            }
          } else {
            // 如果未收藏，添加收藏
            await saveFavorite(actualSource, actualId, {
              title: actualTitle,
              source_name: source_name || '',
              year: actualYear || '',
              cover: actualPoster,
              total_episodes: actualEpisodes ?? 1,
              save_time: Date.now(),
            });
            if (from === 'search') {
              setSearchFavorited(true);
            } else {
              setFavorited(true);
            }
          }
        } catch (err) {
          throw new Error('切换收藏状态失败');
        }
      },
      [
        from,
        actualSource,
        actualId,
        actualTitle,
        source_name,
        actualYear,
        actualPoster,
        actualEpisodes,
        favorited,
        searchFavorited,
      ]
    );

    const handleDeleteRecord = useCallback(
      async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        if (from !== 'playrecord' || !actualSource || !actualId) return;
        try {
          await deletePlayRecord(actualSource, actualId);
          onDelete?.();
        } catch (err) {
          throw new Error('删除播放记录失败');
        }
      },
      [from, actualSource, actualId, onDelete]
    );

    const selectedPlaybackHref = useMemo(() => {
      const searchOnly = from === 'douban' || from === 'tmdb';
      return appendSpecialSourceParam(
        filmPlaybackHref({
          title: actualTitle,
          source: searchOnly ? undefined : actualSource,
          id: searchOnly ? undefined : actualId,
          year: actualYear,
          searchType: actualSearchType,
          searchTitle: actualQuery,
          prefer: isAggregate,
          duanju: isDuanju,
        })
      );
    }, [
      from,
      actualTitle,
      actualSource,
      actualId,
      actualYear,
      actualSearchType,
      actualQuery,
      isAggregate,
      isDuanju,
    ]);

    const handleClick = useCallback(() => {
      if (isUpcoming) {
        setShowUpcomingInfo(true);
        setTimeout(() => setShowUpcomingInfo(false), 2000);
        return;
      }
      onBeforeNavigate?.();
      if (origin === 'live' && actualSource && actualId) {
        router.push(
          '/live?' +
            new URLSearchParams({
              source: actualSource.replace('live_', ''),
              id: actualId.replace('live_', ''),
            })
        );
      } else {
        if (
          window.location.pathname + window.location.search ===
          selectedPlaybackHref
        )
          requestPlayback?.(selectedPlaybackHref, 'user');
        else router.push(selectedPlaybackHref);
      }
    }, [
      isUpcoming,
      onBeforeNavigate,
      origin,
      actualSource,
      actualId,
      selectedPlaybackHref,
      requestPlayback,
      router,
    ]);

    // 新标签页播放处理函数
    const handlePlayInNewTab = useCallback(() => {
      // 即将上映的电影不跳转
      if (isUpcoming) {
        return;
      }

      onBeforeNavigate?.();

      if (origin === 'live' && actualSource && actualId) {
        // 直播内容跳转到直播页面
        const url = `/live?source=${actualSource.replace(
          'live_',
          ''
        )}&id=${actualId.replace('live_', '')}`;
        openExternal(url);
      } else if (
        from === 'douban' ||
        from === 'tmdb' ||
        (isAggregate && !actualSource && !actualId)
      ) {
        const url = appendSpecialSourceParam(
          `/play?title=${encodeURIComponent(actualTitle.trim())}${
            actualYear ? `&year=${actualYear}` : ''
          }${actualSearchType ? `&stype=${actualSearchType}` : ''}${
            isAggregate ? '&prefer=true' : ''
          }${
            actualQuery
              ? `&stitle=${encodeURIComponent(actualQuery.trim())}`
              : ''
          }`
        );
        openExternal(url);
      } else if (actualSource && actualId) {
        const url = appendSpecialSourceParam(
          `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
            actualTitle
          )}${actualYear ? `&year=${actualYear}` : ''}${
            isAggregate ? '&prefer=true' : ''
          }${
            actualQuery
              ? `&stitle=${encodeURIComponent(actualQuery.trim())}`
              : ''
          }${actualSearchType ? `&stype=${actualSearchType}` : ''}${
            isDuanju ? '&duanju=1' : ''
          }`
        );
        openExternal(url);
      }
    }, [
      isUpcoming,
      openExternal,
      origin,
      from,
      actualSource,
      actualId,
      actualTitle,
      actualYear,
      isAggregate,
      actualQuery,
      actualSearchType,
      onBeforeNavigate,
      isDuanju,
    ]);

    // 检查搜索结果的收藏状态
    const checkSearchFavoriteStatus = useCallback(async () => {
      if (
        from === 'search' &&
        !isAggregate &&
        actualSource &&
        actualId &&
        searchFavorited === null
      ) {
        try {
          const fav = await isFavorited(actualSource, actualId);
          setSearchFavorited(fav);
        } catch (err) {
          setSearchFavorited(false);
        }
      }
    }, [from, isAggregate, actualSource, actualId, searchFavorited]);

    // 长按操作
    const handleLongPress = useCallback(() => {
      if (!showMobileActions) {
        // 防止重复触发
        // 立即显示菜单，避免等待数据加载导致动画卡顿
        setShowMobileActions(true);

        // 异步检查收藏状态，不阻塞菜单显示
        if (
          from === 'search' &&
          !isAggregate &&
          actualSource &&
          actualId &&
          searchFavorited === null
        ) {
          checkSearchFavoriteStatus();
        }
      }
    }, [
      showMobileActions,
      from,
      isAggregate,
      actualSource,
      actualId,
      searchFavorited,
      checkSearchFavoriteStatus,
    ]);

    // 长按手势hook
    const longPressProps = useLongPress({
      onLongPress: handleLongPress,
      onClick: () => {
        if (detailOnTouch) setShowDetailPanel(true);
        else handleClick();
      }, // 首页触屏先进入详情，记录卡保留恢复播放
      longPressDelay: 500,
    });

    // 计算距离上映的天数（使用本地时区）
    const daysUntilRelease = useMemo(() => {
      if (!isUpcoming || !releaseDate) return null;

      // 获取今天的本地日期（午夜）
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // 将日期字符串解析为本地时区的日期对象
      // 使用 'YYYY-MM-DD' 格式直接构造，避免 UTC 解析问题
      const [releaseYear, releaseMonth, releaseDay] = releaseDate
        .split('-')
        .map(Number);
      const release = new Date(releaseYear, releaseMonth - 1, releaseDay);

      const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
      const todayDate = new Date(todayYear, todayMonth - 1, todayDay);

      const diffTime = release.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    }, [isUpcoming, releaseDate]);

    const config = useMemo(
      () => cardConfig(from, rate, isUpcoming),
      [from, rate, isUpcoming]
    );

    const upcomingReleaseText = useMemo(() => {
      if (!isUpcoming || daysUntilRelease === null) return undefined;
      if (daysUntilRelease > 0) return `${daysUntilRelease}天后上映`;
      if (daysUntilRelease === 0) return '今日上映';
      return '已上映';
    }, [isUpcoming, daysUntilRelease]);

    const openTrailerPicker = useCallback(async () => {
      if (!actualTitle) return;
      setShowMobileActions(false);
      setTrailerError(null);
      setTrailerLoading(true);
      setShowTrailerPicker(true);

      try {
        const params = new URLSearchParams();
        if (tmdb_id) params.set('id', String(tmdb_id));
        if (actualSearchType) params.set('type', actualSearchType);
        if (actualTitle) params.set('title', actualTitle);
        if (actualYear) params.set('year', actualYear);

        const res = await apiFetch(`/api/tmdb/videos?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || '获取预告片失败');
        }

        setTrailerVideos(data.videos || []);
      } catch (err) {
        setTrailerVideos([]);
        setTrailerError(err instanceof Error ? err.message : '获取预告片失败');
      } finally {
        setTrailerLoading(false);
      }
    }, [actualSearchType, actualTitle, actualYear, tmdb_id]);

    // 移动端操作菜单配置
    const mobileActions = useMemo(
      () =>
        buildMobileActions({
          config,
          from,
          origin,
          externalMode,
          actualSource,
          actualId,
          favorited,
          searchFavorited,
          actualDoubanId,
          isBangumi,
          isUpcoming,
          actualTitle,
          aiEnabled,
          isAdminUser,
          resolvedIsAnime,
          handleClick,
          handlePlayInNewTab,
          handleToggleFavorite,
          handleDeleteRecord,
          openExternal,
          openTrailerPicker,
          setShowMobileActions,
          setShowDetailPanel,
          setShowAIChat,
          setShowAnimeSubscribe,
        }),
      [
        config,
        from,
        actualSource,
        actualId,
        favorited,
        searchFavorited,
        actualDoubanId,
        isBangumi,
        handleClick,
        handleToggleFavorite,
        handleDeleteRecord,
        handlePlayInNewTab,
        externalMode,
        openExternal,
        aiEnabled,
        actualTitle,
        isUpcoming,
        origin,
        openTrailerPicker,
        isAdminUser,
        resolvedIsAnime,
      ]
    );

    return (
      <>
        {externalAction.feedback}
        <div
          ref={detailTriggerRef}
          className={
            'tm-video-card tm-video-card-tile' +
            (isUpcoming ? ' tm-video-card-upcoming' : '') +
            (showUpcomingInfo ? ' tm-video-card-upcoming-open' : '')
          }
          role='button'
          tabIndex={0}
          aria-label={(compactRecord ? '继续观看 ' : '查看 ') + actualTitle}
          data-horizontal={orientation === 'horizontal'}
          data-compact={compactRecord}
          {...posterTiltHandlers}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (detailOnTouch) setShowDetailPanel(true);
              else handleClick();
            }
          }}
          onClick={() => {
            if (
              detailOnTouch &&
              matchesMedia('(hover: none), (pointer: coarse)')
            )
              setShowDetailPanel(true);
            else handleClick();
          }}
          {...longPressProps}
          onContextMenu={(e) => {
            // 阻止默认右键菜单
            e.preventDefault();
            e.stopPropagation();

            // 右键弹出操作菜单
            setShowMobileActions(true);

            // 异步检查收藏状态，不阻塞菜单显示
            if (
              from === 'search' &&
              !isAggregate &&
              actualSource &&
              actualId &&
              searchFavorited === null
            ) {
              checkSearchFavoriteStatus();
            }

            return false;
          }}
          onDragStart={(e) => {
            // 阻止拖拽
            e.preventDefault();
            return false;
          }}
        >
          {/* 海报容器：不在外层 overflow-hidden，避免裁切来源数量浮层 */}
          <div
            className={
              'tm-video-card-art tm-video-card-poster' +
              (origin === 'live' ? ' tm-video-card-poster-live' : '') +
              (orientation === 'horizontal' ? ' tm-video-card-poster-wide' : '')
            }
          >
            {/* 仅图片层做圆角裁剪 */}
            <div className='tm-video-card-clip'>
              {/* 骨架屏 */}
              {!isLoading && !isDirectPlaySource && (
                <ImagePlaceholder
                  aspectRatio={
                    orientation === 'horizontal'
                      ? 'aspect-video'
                      : 'aspect-[2/3]'
                  }
                />
              )}
              {isDirectPlaySource ||
              !displayPoster ||
              (from === 'playrecord' && !actualPoster) ? (
                <div
                  className='tm-video-card-initial tm-media-initial'
                  aria-hidden='true'
                >
                  {Array.from(actualTitle.trim())[0] || '影'}
                </div>
              ) : isNetdiskSource(actualSource) &&
                !actualPoster &&
                displayPoster === netdiskPosterPlaceholder ? (
                <div className='tm-video-card-netdisk'>
                  <Cloud className='tm-video-card-netdisk-icon' />
                </div>
              ) : (
                <Image
                  src={displayPoster}
                  alt={actualTitle}
                  fill
                  data-loaded={isLoading}
                  className={
                    'tm-video-card-image' +
                    (origin === 'live' ? ' tm-video-card-image-contain' : '')
                  }
                  referrerPolicy='no-referrer'
                  loading='lazy'
                  onLoadingComplete={() => {
                    setIsLoading(true);
                  }}
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    const doubanFallbackPoster =
                      getDoubanImageFallbackUrl(actualPoster);
                    if (
                      doubanFallbackPoster &&
                      tryApplyDoubanImageFallback(img, actualPoster)
                    ) {
                      setDisplayPoster(doubanFallbackPoster);
                      return;
                    }

                    const bangumiFallbackPoster =
                      getBangumiImageFallbackUrl(actualPoster);
                    if (
                      bangumiFallbackPoster &&
                      tryApplyBangumiImageFallback(img, actualPoster)
                    ) {
                      setDisplayPoster(bangumiFallbackPoster);
                      return;
                    }

                    if (
                      clearBangumiImageFallbackCacheIfFailed(img, actualPoster)
                    ) {
                      setDisplayPoster(processedPoster);
                      return;
                    }

                    // 图片加载失败时的重试机制
                    if (!img.dataset.retried) {
                      img.dataset.retried = 'true';
                      setTimeout(() => {
                        setDisplayPoster(processedPoster);
                        img.src = processedPoster;
                      }, 2000);
                    }
                  }}
                  onDragStart={(e) => {
                    e.preventDefault();
                    return false;
                  }}
                />
              )}

              {/* 悬浮遮罩 */}
              <div className='tm-video-card-overlay' />
            </div>

            {/* 播放按钮或上映倒计时 */}
            {isUpcoming && daysUntilRelease !== null ? (
              <div
                className={
                  'tm-video-card-countdown' +
                  (showUpcomingInfo ? ' tm-video-card-countdown-open' : '')
                }
              >
                <div className='tm-video-card-countdown-text'>
                  {upcomingReleaseText}
                </div>
              </div>
            ) : (
              config.showPlayButton &&
              !compactRecord && (
                <div className='tm-video-card-play'>
                  <PlayCircleIcon
                    size={50}
                    strokeWidth={0.8}
                    className='tm-video-card-play-icon'
                  />
                </div>
              )
            )}

            {/* 操作按钮 - 继续观看不显示桌面端悬停按钮 */}
            {(config.showHeart || config.showCheckCircle) &&
              from !== 'playrecord' && (
                <div data-button='true' className='tm-video-card-actions'>
                  {config.showCheckCircle && (
                    <Trash2
                      onClick={handleDeleteRecord}
                      size={20}
                      className='tm-video-card-action'
                    />
                  )}
                  {config.showHeart && from !== 'search' && (
                    <Heart
                      onClick={handleToggleFavorite}
                      size={20}
                      className={
                        'tm-video-card-heart' +
                        (favorited ? ' tm-video-card-heart-on' : '')
                      }
                    />
                  )}
                </div>
              )}

            {/* 季度徽章 */}
            {seasonNumber && (
              <div
                className='tm-video-card-season'
                title={seasonName || `第${seasonNumber}季`}
              >
                S{seasonNumber}
              </div>
            )}

            {config.showRating && rate && Number(rate) > 0 && (
              <span className='mtv-rate' aria-label={'评分 ' + rate}>
                <Star size={11} aria-hidden />
                {rate}
              </span>
            )}

            {/* 竖向模式：顶部直链地址显示 */}
            {orientation === 'vertical' &&
              isDirectPlaySource &&
              directLinkUrl && (
                <div className='tm-video-card-url'>
                  <div className='tm-video-card-url-text' title={directLinkUrl}>
                    {directLinkUrl}
                  </div>
                </div>
              )}

            {actualEpisodes &&
              actualEpisodes > 1 &&
              orientation === 'vertical' && (
                <div className='tm-video-card-badges'>
                  {/* 集数显示 */}
                  <div className='tm-video-card-badge'>
                    {currentEpisode !== undefined && currentEpisode !== null
                      ? `${currentEpisode}/${actualEpisodes}`
                      : `共${actualEpisodes}集`}
                  </div>

                  {/* 年份显示 */}
                  {displayYear && (
                    <div className='tm-video-card-badge'>{displayYear}年</div>
                  )}
                </div>
              )}

            {/* 竖向模式：来源名称显示在海报右下角 */}
            {orientation === 'vertical' &&
              config.showSourceName &&
              source_name &&
              !cmsData && (
                <div className='tm-video-card-source'>
                  <span className='tm-video-card-source-tag'>
                    {origin === 'live' && (
                      <Radio size={8} className='tm-video-card-live-icon' />
                    )}
                    {source_name}
                  </span>
                </div>
              )}

            {/* 豆瓣链接 */}
            {config.showDoubanLink &&
              actualDoubanId &&
              actualDoubanId !== 0 && (
                <a
                  href={
                    isBangumi
                      ? getBangumiSubjectUrl(actualDoubanId.toString())
                      : `https://movie.douban.com/subject/${actualDoubanId.toString()}`
                  }
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={(e) => e.stopPropagation()}
                  className='tm-video-card-douban tm-press tm-press'
                >
                  <div className='tm-video-card-douban-icon'>
                    <Link size={16} />
                  </div>
                </a>
              )}

            {/* 聚合播放源指示器 */}
            {isAggregate &&
              dynamicSourceNames &&
              dynamicSourceNames.length > 0 &&
              (() => {
                const uniqueSources = Array.from(new Set(dynamicSourceNames));
                const sourceCount = uniqueSources.length;

                return (
                  <div
                    data-button='true'
                    className={
                      'tm-video-card-sources' +
                      (from === 'search' ? ' tm-video-card-sources-shown' : '')
                    }
                    // 阻止冒泡到卡片：避免长按/右键同时弹出操作菜单
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchMove={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      // 右键/中键按下时也不要触发卡片手势
                      if (e.button !== 0) {
                        e.stopPropagation();
                      }
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div className='tm-video-card-caption-inner'>
                      <div className='tm-video-card-sources-count'>
                        {sourceCount}
                      </div>

                      {/* 播放源详情悬浮框 */}
                      {(() => {
                        // 优先显示的播放源（常见的主流平台）
                        const prioritySources = [
                          '爱奇艺',
                          '腾讯视频',
                          '优酷',
                          '芒果TV',
                          '哔哩哔哩',
                          'Netflix',
                          'Disney+',
                        ];

                        // 按优先级排序播放源
                        const sortedSources = uniqueSources.sort((a, b) => {
                          const aIndex = prioritySources.indexOf(a);
                          const bIndex = prioritySources.indexOf(b);
                          if (aIndex !== -1 && bIndex !== -1)
                            return aIndex - bIndex;
                          if (aIndex !== -1) return -1;
                          if (bIndex !== -1) return 1;
                          return a.localeCompare(b);
                        });

                        const maxDisplayCount = 6; // 最多显示6个
                        const displaySources = sortedSources.slice(
                          0,
                          maxDisplayCount
                        );
                        const hasMore = sortedSources.length > maxDisplayCount;
                        const remainingCount =
                          sortedSources.length - maxDisplayCount;

                        return (
                          <div className='tm-video-card-sources-pop'>
                            <div className='tm-video-card-sources-box'>
                              {/* 单列布局 */}
                              <div className='tm-video-card-sources-list'>
                                {displaySources.map((sourceName, index) => (
                                  <div
                                    key={index}
                                    className='tm-video-card-sources-item'
                                  >
                                    <div className='tm-video-card-sources-dot'></div>
                                    <span
                                      className='tm-video-card-sources-name'
                                      title={sourceName}
                                    >
                                      {sourceName}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* 显示更多提示 */}
                              {hasMore && (
                                <div className='tm-video-card-sources-more'>
                                  <div className='tm-video-card-sources-more-row'>
                                    <span className='tm-video-card-sources-more-text'>
                                      +{remainingCount} 播放源
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* 小箭头：放在内容盒外侧，避免被裁切 */}
                              <div className='tm-video-card-sources-arrow'></div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

            {/* 横向模式：标题和进度条在海报上 */}
            {orientation === 'horizontal' && (
              <>
                {/* 顶部渐变遮罩 - 用于标题背景 */}
                <div className='tm-video-horizontal-title'>
                  {/* 标题 */}
                  <div className='tm-video-horizontal-heading'>
                    <span
                      className='tm-video-horizontal-name'
                      title={actualTitle}
                    >
                      {actualTitle}
                    </span>
                  </div>

                  {/* 集数信息 - 只有超过1集时才显示 */}
                  {currentEpisode && actualEpisodes && actualEpisodes > 1 && (
                    <div className='tm-video-horizontal-meta'>
                      第{currentEpisode}集 · 共{actualEpisodes}集
                    </div>
                  )}

                  {/* 直链地址 */}
                  {isDirectPlaySource && directLinkUrl && (
                    <div
                      className='tm-video-horizontal-url'
                      title={directLinkUrl}
                    >
                      {directLinkUrl}
                    </div>
                  )}
                </div>

                {/* 底部渐变遮罩 - 用于进度条背景 */}
                <div className='tm-video-horizontal-progress'>
                  {/* 进度条 */}
                  {config.showProgress &&
                    progress !== undefined &&
                    origin !== 'live' && (
                      <div>
                        {/* 来源和时长显示 - 在进度条上方 */}
                        <div className='tm-video-horizontal-row'>
                          {/* 时长显示 - 左侧 */}
                          {from === 'playrecord' &&
                            playTime !== undefined &&
                            totalTime !== undefined && (
                              <div className='tm-video-horizontal-time'>
                                {formatDuration(playTime)}
                              </div>
                            )}

                          {/* 来源 - 右侧 */}
                          {config.showSourceName && source_name && !cmsData && (
                            <span className='tm-video-horizontal-source'>
                              {source_name}
                            </span>
                          )}
                        </div>
                        <div className='tm-video-horizontal-bar'>
                          <div
                            className='tm-video-horizontal-fill'
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                  {/* 直播时只显示来源 */}
                  {origin === 'live' &&
                    config.showSourceName &&
                    source_name &&
                    !cmsData && (
                      <div className='tm-video-horizontal-live'>
                        <span className='tm-video-horizontal-source'>
                          <Radio size={8} className='tm-video-card-live-icon' />
                          {source_name}
                        </span>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>

          {compactRecord && (
            <>
              <div className='tm-home-resume-details'>
                <strong>{actualTitle}</strong>
                <small>
                  {origin === 'live'
                    ? '直播'
                    : (totalTime ?? 0) > 0
                    ? `${
                        actualEpisodes && actualEpisodes > 1
                          ? `第 ${currentEpisode} 集 · `
                          : ''
                      }看到 ${Math.round(progress)}%`
                    : '进度未记录'}
                </small>
              </div>
              <span className='tm-home-resume-play' aria-hidden='true'>
                <Play size={18} />
              </span>
            </>
          )}

          {/* 竖向模式：进度条和标题在海报下方 */}
          {orientation === 'vertical' && (
            <>
              {/* 进度条 */}
              {config.showProgress && progress !== undefined && (
                <div className='tm-video-card-progress'>
                  <div
                    className='tm-video-card-progress-fill'
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* 标题 */}
              <div className='tm-video-card-caption'>
                <div className='tm-video-card-caption-inner'>
                  <span className='tm-video-card-title'>{actualTitle}</span>
                  {/* 自定义 tooltip */}
                  <div className='tm-video-card-tooltip'>
                    {actualTitle}
                    <div className='tm-video-card-tooltip-arrow'></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 操作菜单 - 支持右键和长按触发 */}
        <MobileActionSheet
          isOpen={showMobileActions}
          onClose={() => setShowMobileActions(false)}
          title={actualTitle}
          poster={displayPoster}
          actions={mobileActions}
          sources={
            isAggregate && dynamicSourceNames
              ? Array.from(new Set(dynamicSourceNames))
              : undefined
          }
          isAggregate={isAggregate}
          sourceName={cmsData ? undefined : source_name}
          directLinkUrl={directLinkUrl || undefined}
          currentEpisode={currentEpisode}
          totalEpisodes={actualEpisodes}
          origin={origin}
          description={upcomingReleaseText}
          onPosterClick={() => {
            setShowImageViewer(true);
          }}
        />

        <TrailerPickerDialog
          isOpen={showTrailerPicker}
          title={actualTitle}
          loading={trailerLoading}
          error={trailerError}
          videos={trailerVideos}
          onClose={() => setShowTrailerPicker(false)}
          onRetry={openTrailerPicker}
          onSelect={(video) => {
            openExternal(`https://www.youtube.com/watch?v=${video.key}`);
            setShowTrailerPicker(false);
          }}
        />

        {/* AI问片面板 - 只在打开或正在流式响应时渲染 */}
        {aiEnabled && (showAIChat || isAIStreaming) && (
          <AIChatPanel
            isOpen={showAIChat}
            onClose={() => setShowAIChat(false)}
            onStreamingChange={setIsAIStreaming}
            context={{
              title: actualTitle,
              year: actualYear,
              douban_id: actualDoubanId,
              tmdb_id,
              type: actualSearchType as 'movie' | 'tv',
              currentEpisode,
            }}
            welcomeMessage={
              aiDefaultMessageWithVideo
                ? aiDefaultMessageWithVideo.replace(
                    '{title}',
                    actualTitle || ''
                  )
                : `想了解《${actualTitle}》的更多信息吗？我可以帮你查询剧情、演员、评价等。`
            }
          />
        )}

        {/* 详情面板 */}
        {showDetailPanel && (
          <DetailPanel
            isOpen={showDetailPanel}
            returnFocusRef={detailTriggerRef}
            onClose={() => setShowDetailPanel(false)}
            title={actualTitle}
            poster={displayPoster}
            doubanId={actualDoubanId}
            bangumiId={isBangumi ? actualDoubanId : undefined}
            isBangumi={isBangumi}
            tmdbId={tmdb_id}
            type={actualSearchType as 'movie' | 'tv'}
            year={actualYear}
            seasonNumber={seasonNumber}
            currentEpisode={currentEpisode}
            cmsData={cmsData}
            sourceId={id}
            source={source}
            onPlay={handleClick}
            onWatchInRoom={() =>
              router.push(
                roomSelectionHref(
                  queuePlaybackHref(selectedPlaybackHref, currentEpisode || 1)
                )
              )
            }
            onFavorite={
              from !== 'douban' && from !== 'tmdb' && actualSource && actualId
                ? handleToggleFavorite
                : undefined
            }
            favorited={from === 'search' ? searchFavorited === true : favorited}
          />
        )}

        {/* 添加追番订阅（管理员） */}
        <AnimeSubscribeModal
          isOpen={showAnimeSubscribe}
          onClose={() => setShowAnimeSubscribe(false)}
          initialTitle={actualTitle}
          initialLastEpisode={
            from === 'playrecord' && currentEpisode ? currentEpisode : 0
          }
          onSuccess={() => {
            setAnimeSubscribeToast('已添加追番订阅');
            window.setTimeout(() => setAnimeSubscribeToast(''), 2500);
          }}
        />
        {animeSubscribeToast ? (
          <div className='tm-video-card-toast'>{animeSubscribeToast}</div>
        ) : null}

        {/* 图片查看器 */}
        {showImageViewer && (
          <ImageViewer
            isOpen={showImageViewer}
            onClose={() => setShowImageViewer(false)}
            imageUrl={actualPoster}
            alt={actualTitle}
          />
        )}
      </>
    );
  }
);

export default memo(VideoCard);
