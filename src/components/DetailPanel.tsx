'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { getBangumiSubject, getBangumiSubjectUrl } from '@/lib/bangumi.client';
import { useReducedMotionSetting } from '@/lib/motion';
import { appendSpecialSourceParam } from '@/lib/special-source.client';
import { getTMDBImageUrl } from '@/lib/tmdb.client';
import { processImageUrl } from '@/lib/utils';

import ProxyImage from '@/components/ProxyImage';

import DetailActions from './detail/DetailActions';
import DetailActors from './detail/DetailActors';
import {
  CorrectionContent,
  GalleryContent,
  StillsContent,
} from './detail/DetailAuxiliaryPanels';
import DetailContent from './detail/DetailContent';
import DetailEpisodes from './detail/DetailEpisodes';
import DetailMoreMenu, { type DetailMenuItem } from './detail/DetailMoreMenu';
import DetailShell from './detail/DetailShell';
import type { DetailData, Episode, GalleryImage } from './detail/types';

interface DetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  poster?: string;
  doubanId?: number;
  bangumiId?: number;
  isBangumi?: boolean;
  tmdbId?: number;
  type?: 'movie' | 'tv';
  year?: string;
  seasonNumber?: number;
  currentEpisode?: number;
  cmsData?: {
    desc?: string;
    episodes?: string[];
    episodes_titles?: string[];
  };
  sourceId?: string;
  source?: string;
  useDrawer?: boolean;
  drawerWidth?: string;
  onPlay?: () => void;
  onTogether?: () => void;
  backdrop?: string;
  onFavorite?: React.MouseEventHandler<HTMLButtonElement>;
  favorited?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement>;
}

// 从多个 TMDB 搜索结果中挑选最匹配的一个
// 依据媒体类型（单集大概率是电影）与年份辅助打分，无有效线索时降级到第一个
const pickBestTmdbResult = (
  results: any[],
  hints: { mediaTypeHint?: 'movie' | 'tv'; year?: string }
): any => {
  if (!results || results.length === 0) return undefined;
  if (results.length === 1) return results[0];

  const { mediaTypeHint, year } = hints;
  const targetYear = year ? parseInt(year, 10) : NaN;

  const getResultYear = (r: any): number => {
    const date =
      r.media_type === 'movie' ? r.release_date : r.first_air_date;
    return date ? parseInt(String(date).substring(0, 4), 10) : NaN;
  };

  let best = results[0];
  let bestScore = -Infinity;

  results.forEach((r) => {
    let score = 0;

    // 媒体类型匹配（权重最高）
    if (mediaTypeHint && r.media_type === mediaTypeHint) {
      score += 10;
    }

    // 年份匹配：完全一致加分最高，相差 1 年次之
    if (!Number.isNaN(targetYear)) {
      const ry = getResultYear(r);
      if (!Number.isNaN(ry)) {
        const diff = Math.abs(ry - targetYear);
        if (diff === 0) score += 8;
        else if (diff === 1) score += 4;
        else if (diff <= 2) score += 1;
      }
    }

    // 严格大于才更新，保证同分时保留靠前（更相关）的结果
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  });

  return best;
};

const DetailPanel: React.FC<DetailPanelProps> = ({
  isOpen,
  onClose,
  title,
  poster,
  doubanId,
  bangumiId,
  isBangumi,
  tmdbId,
  type = 'movie',
  year,
  seasonNumber,
  currentEpisode,
  cmsData,
  sourceId,
  source,
  useDrawer = false,
  drawerWidth = 'w-full md:w-[25%]',
  onPlay,
  onTogether,
  backdrop,
  onFavorite,
  favorited,
  returnFocusRef,
}) => {
  const reducedMotion = useReducedMotionSetting();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasonData, setSeasonData] = useState<{
    seasons: any[];
    episodes: Episode[];
  } | null>(null);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(
    new Set()
  );
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonsLoaded, setSeasonsLoaded] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryTotal, setGalleryTotal] = useState(0);
  const [galleryScrollTop, setGalleryScrollTop] = useState(0);
  const [galleryViewportHeight, setGalleryViewportHeight] = useState(0);
  const [galleryViewportWidth, setGalleryViewportWidth] = useState(0);
  const galleryScrollRef = React.useRef<HTMLDivElement>(null);

  // TMDB 搜索结果（供纠错切换）
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [showTmdbCorrection, setShowTmdbCorrection] = useState(false);

  // 集数剧照状态
  const [showEpisodeStills, setShowEpisodeStills] = useState(false);
  const [episodeStillsLoading, setEpisodeStillsLoading] = useState(false);
  const [episodeStillsError, setEpisodeStillsError] = useState<string | null>(
    null
  );
  const [episodeStills, setEpisodeStills] = useState<string[]>([]);
  const [episodeStillsTitle, setEpisodeStillsTitle] = useState('');

  // 数据源状态管理
  const [currentSource, setCurrentSource] = useState<
    'douban' | 'bangumi' | 'cms' | 'tmdb'
  >('tmdb');
  const [originalSource, setOriginalSource] = useState<
    'douban' | 'bangumi' | 'cms' | 'tmdb'
  >('tmdb');
  const [isUsingTmdb, setIsUsingTmdb] = useState(false);
  const [originalDetailData, setOriginalDetailData] =
    useState<DetailData | null>(null);

  const getExternalUrl = () => {
    if (currentSource === 'douban' && doubanId) {
      return `https://movie.douban.com/subject/${doubanId}`;
    }

    if (currentSource === 'bangumi') {
      const actualBangumiId = bangumiId || doubanId;
      if (actualBangumiId) {
        return getBangumiSubjectUrl(actualBangumiId);
      }
    }

    if (currentSource === 'tmdb') {
      const actualTmdbId = detailData?.tmdbId || tmdbId;
      const actualMediaType = detailData?.mediaType || type;
      if (actualTmdbId) {
        return `https://www.themoviedb.org/${actualMediaType}/${actualTmdbId}`;
      }
    }

    return null;
  };

  const externalUrl = getExternalUrl();

  // 拖动滚动状态
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const episodesScrollRef = React.useRef<HTMLDivElement>(null);
  const actorsScrollRef = React.useRef<HTMLDivElement>(null);
  const [isActorsDragging, setIsActorsDragging] = useState(false);
  const [isActorsMouseDown, setIsActorsMouseDown] = useState(false);
  const [actorsStartX, setActorsStartX] = useState(0);
  const [actorsScrollLeft, setActorsScrollLeft] = useState(0);

  // 图片点击处理
  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setShowImageViewer(true);
  };

  // 查看某一集的剧照
  const handleEpisodeStillsClick = async (episode: Episode) => {
    const tmdbId = detailData?.tmdbId;
    if (!tmdbId) return;

    setEpisodeStillsTitle(`第${episode.episode_number}集 剧照`);
    setShowEpisodeStills(true);
    setEpisodeStillsLoading(true);
    setEpisodeStillsError(null);
    setEpisodeStills([]);

    try {
      const response = await fetch(
        `/api/tmdb/episode-images?id=${tmdbId}&season=${selectedSeason}&episode=${episode.episode_number}`
      );

      if (!response.ok) {
        throw new Error('获取剧照失败');
      }

      const data = await response.json();
      const stills: string[] = (data.list || []).map((item: { file_path: string }) =>
        getTMDBImageUrl(item.file_path, 'original')
      );

      // 兜底：接口无剧照时至少展示当前集封面
      if (stills.length === 0 && episode.still_path) {
        stills.push(getTMDBImageUrl(episode.still_path, 'original'));
      }

      setEpisodeStills(stills);
    } catch (err) {
      console.error('获取集数剧照失败:', err);
      setEpisodeStillsError(err instanceof Error ? err.message : '获取剧照失败');
    } finally {
      setEpisodeStillsLoading(false);
    }
  };

  const galleryTmdbId = detailData?.tmdbId || tmdbId;
  const galleryMediaType = detailData?.mediaType || type;
  const canShowGalleryEntry = !!galleryTmdbId && !!galleryMediaType;

  const fetchGalleryImages = async () => {
    if (!galleryTmdbId || !galleryMediaType) return;

    setGalleryLoading(true);
    setGalleryError(null);

    try {
      const response = await fetch(
        `/api/tmdb/images?id=${galleryTmdbId}&type=${galleryMediaType}`
      );

      if (!response.ok) {
        throw new Error('获取照片墙失败');
      }

      const data = await response.json();
      setGalleryImages(data.list || []);
      setGalleryTotal(data.total || 0);
    } catch (err) {
      console.error('获取照片墙失败:', err);
      setGalleryError(err instanceof Error ? err.message : '获取照片墙失败');
    } finally {
      setGalleryLoading(false);
    }
  };

  const openGallery = () => {
    setShowGallery(true);
  };

  // 确保组件在客户端挂载后才渲染 Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showGallery) {
      setGalleryImages([]);
      setGalleryError(null);
      setGalleryLoading(false);
      setGalleryTotal(0);
      setGalleryScrollTop(0);
      setGalleryViewportHeight(0);
      setGalleryViewportWidth(0);
      return;
    }

    fetchGalleryImages();
  }, [showGallery, galleryTmdbId, galleryMediaType]);

  useEffect(() => {
    if (!showGallery || !galleryScrollRef.current) return;

    const element = galleryScrollRef.current;

    const updateMetrics = () => {
      setGalleryViewportHeight(element.clientHeight);
      setGalleryViewportWidth(element.clientWidth);
      setGalleryScrollTop(element.scrollTop);
    };

    updateMetrics();
    element.addEventListener('scroll', updateMetrics, { passive: true });
    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener('scroll', updateMetrics);
      resizeObserver.disconnect();
    };
  }, [showGallery]);

  // 控制动画状态
  useEffect(() => {
    let animationId: number;
    let timer: NodeJS.Timeout;

    if (isOpen) {
      setIsVisible(true);
      animationId = requestAnimationFrame(() => {
        animationId = requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      timer = setTimeout(
        () => {
          setIsVisible(false);
        },
        reducedMotion ? 120 : 320
      );
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOpen, reducedMotion]);

  useEffect(() => {
    if (!isOpen) {
      setShowGallery(false);
      setShowEpisodeStills(false);
      setShowTmdbCorrection(false);
      setTmdbResults([]);
    }
  }, [isOpen]);

  // 从标题中解析搜索关键词与季度号
  const parseTmdbSearchInfo = () => {
    let searchTitle = title;
    let extractedSeasonNumber = seasonNumber;

    // 匹配各种季度格式: 第一季、第1季、第一部、Season 1、S1等
    const seasonPatterns = [
      /第([一二三四五六七八九十\d]+)[季部]/,
      /Season\s*(\d+)/i,
      /S(\d+)/i,
    ];

    for (const pattern of seasonPatterns) {
      const match = title.match(pattern);
      if (match) {
        searchTitle = title.replace(pattern, '').trim();
        if (!extractedSeasonNumber) {
          const seasonStr = match[1];
          const chineseNumbers: Record<string, number> = {
            一: 1,
            二: 2,
            三: 3,
            四: 4,
            五: 5,
            六: 6,
            七: 7,
            八: 8,
            九: 9,
            十: 10,
          };
          extractedSeasonNumber =
            chineseNumbers[seasonStr] || parseInt(seasonStr) || undefined;
        }
        break;
      }
    }

    return { searchTitle, extractedSeasonNumber };
  };

  // 推断媒体类型：集数是更强的线索（单集大概率是电影，多集为剧集），
  // 无集数信息时降级用调用方传入的 type
  const getMediaTypeHint = (): 'movie' | 'tv' | undefined => {
    const episodesCount = cmsData?.episodes?.length;
    if (typeof episodesCount === 'number' && episodesCount > 0) {
      return episodesCount === 1 ? 'movie' : 'tv';
    }
    return type;
  };

  // 根据指定的搜索结果加载 TMDB 详情
  const applyTmdbResult = async (
    result: any,
    extractedSeasonNumber?: number
  ) => {
    const detailId = result.id;
    const mediaType = result.media_type || type;

    // 获取详情
    const detailResponse = await fetch(
      `/api/tmdb/detail?id=${detailId}&type=${mediaType}`
    );
    if (!detailResponse.ok) {
      throw new Error('获取TMDB详情失败');
    }
    const detailResult = await detailResponse.json();

    // 如果有季度信息,尝试获取季度详情
    let seasonDetail = null;
    if (extractedSeasonNumber && mediaType === 'tv') {
      try {
        const seasonResponse = await fetch(
          `/api/tmdb/episodes?id=${detailId}&season=${extractedSeasonNumber}`
        );
        if (seasonResponse.ok) {
          seasonDetail = await seasonResponse.json();
        }
      } catch (err) {
        console.error('获取季度信息失败', err);
      }
    }

    setDetailData({
      title:
        mediaType === 'movie'
          ? detailResult.title
          : seasonDetail?.name
          ? `${detailResult.name} ${seasonDetail.name}`
          : detailResult.name,
      originalTitle:
        mediaType === 'movie'
          ? detailResult.original_title
          : detailResult.original_name,
      year:
        mediaType === 'movie'
          ? detailResult.release_date?.substring(0, 4)
          : seasonDetail?.air_date?.substring(0, 4) ||
            detailResult.first_air_date?.substring(0, 4),
      poster:
        seasonDetail?.poster_path || detailResult.poster_path
          ? processImageUrl(
              getTMDBImageUrl(
                seasonDetail?.poster_path || detailResult.poster_path,
                'w500'
              )
            )
          : poster,
      backdrop: detailResult.backdrop_path
        ? getTMDBImageUrl(detailResult.backdrop_path, 'w1280')
        : undefined,
      rating: detailResult.vote_average
        ? {
            value: detailResult.vote_average,
            count: detailResult.vote_count,
          }
        : undefined,
      intro: seasonDetail?.overview || detailResult.overview,
      genres: detailResult.genres?.map((g: any) => g.name),
      countries: detailResult.production_countries?.map((c: any) => c.name),
      languages: detailResult.spoken_languages?.map((l: any) => l.name),
      duration: detailResult.runtime
        ? `${detailResult.runtime}分钟`
        : undefined,
      episodesCount:
        seasonDetail?.episodes?.length || detailResult.number_of_episodes,
      releaseDate:
        mediaType === 'movie'
          ? detailResult.release_date
          : seasonDetail?.air_date || detailResult.first_air_date,
      status: detailResult.status,
      tagline: detailResult.tagline,
      seasons: detailResult.number_of_seasons,
      overview: detailResult.overview,
      tmdbId: detailId,
      mediaType: mediaType,
      seasonNumber: extractedSeasonNumber,
      seriesTitle: mediaType === 'tv' ? detailResult.name : undefined,
    });
    setCurrentSource('tmdb');
  };

  // 用户从纠错面板中选择某个搜索结果
  const handleSelectTmdbResult = async (result: any) => {
    setShowTmdbCorrection(false);
    setLoading(true);
    setError(null);
    // 重置季度/集数,交给对应 effect 重新加载
    setSeasonData(null);
    setSeasonsLoaded(false);

    try {
      const { extractedSeasonNumber } = parseTmdbSearchInfo();
      await applyTmdbResult(result, extractedSeasonNumber);
    } catch (err) {
      console.error('切换TMDB结果失败:', err);
      setError(err instanceof Error ? err.message : '切换失败');
      setCurrentSource('tmdb');
    } finally {
      setLoading(false);
    }
  };

  // 获取详情数据
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // 如果正在使用 TMDB 数据，强制使用 TMDB
        if (isUsingTmdb && title) {
          await fetchTmdbData();
          return;
        }

        // 优先使用苹果CMS数据（短剧等）
        // 如果 cmsData 存在但 desc 为空，尝试通过 source-detail API 获取
        if (cmsData) {
          setCurrentSource('cms');
          setOriginalSource('cms');
          if (cmsData.desc) {
            // 有 desc，直接使用
            const data = {
              title: title,
              intro: cmsData.desc,
              episodesCount: cmsData.episodes?.length,
              poster: poster,
            };
            setDetailData(data);
            setOriginalDetailData(data);
            setLoading(false);
            return;
          }

          // cmsData 存在但 desc 为空，尝试通过 API 获取详情
          if (sourceId && source) {
            try {
              const response = await fetch(
                appendSpecialSourceParam(`/api/source-detail?id=${encodeURIComponent(
                  sourceId
                )}&source=${encodeURIComponent(
                  source
                )}&title=${encodeURIComponent(title)}`)
              );
              if (response.ok) {
                const data = await response.json();
                const detailData = {
                  title: data.title || title,
                  intro: data.desc || '',
                  episodesCount:
                    data.episodes?.length || cmsData.episodes?.length,
                  poster: data.poster || poster,
                  year: data.year,
                };
                setDetailData(detailData);
                setOriginalDetailData(detailData);
                setLoading(false);
                return;
              }
            } catch (err) {
              console.error('获取source-detail失败:', err);
              // 继续执行后续逻辑
            }
          }
        }

        // 优先使用 Bangumi ID（因为 isBangumi 为 true 时，doubanId 实际上是 bangumiId）
        if (bangumiId || (isBangumi && doubanId)) {
          setCurrentSource('bangumi');
          setOriginalSource('bangumi');
          const actualBangumiId = bangumiId || doubanId;
          if (!actualBangumiId) {
            throw new Error('Bangumi ID 缺失');
          }
          const data = await getBangumiSubject(actualBangumiId);

          const detailData = {
            title: data.name_cn || data.name,
            originalTitle: data.name,
            year: data.date ? data.date.substring(0, 4) : undefined,
            poster: data.images?.large || poster,
            rating: data.rating
              ? {
                  value: data.rating.score,
                  count: data.rating.total,
                }
              : undefined,
            intro: data.summary,
            genres: data.tags?.map((tag: any) => tag.name).slice(0, 5),
            episodesCount: data.eps,
            releaseDate: data.date,
          };
          setDetailData(detailData);
          setOriginalDetailData(detailData);
          return;
        }

        // 使用豆瓣ID
        if (doubanId && !isBangumi) {
          setCurrentSource('douban');
          setOriginalSource('douban');
          const response = await fetch(`/api/douban/detail?id=${doubanId}`);
          if (!response.ok) {
            throw new Error('获取豆瓣详情失败');
          }
          const data = await response.json();

          const detailData = {
            title: data.title,
            originalTitle: data.original_title,
            year: data.year,
            poster: data.pic?.large || data.pic?.normal || poster,
            rating: data.rating
              ? {
                  value: data.rating.value,
                  count: data.rating.count,
                }
              : undefined,
            intro: data.intro,
            genres: data.genres,
            directors: data.directors,
            actors: data.actors,
            countries: data.countries,
            languages: data.languages,
            duration: data.durations?.[0],
            episodesCount: data.episodes_count,
          };
          setDetailData(detailData);
          setOriginalDetailData(detailData);
          return;
        }

        // 使用 TMDB 搜索
        if (title) {
          setCurrentSource('tmdb');
          setOriginalSource('tmdb');
          await fetchTmdbData();
          return;
        }

        throw new Error('缺少必要的查询参数');
      } catch (err) {
        console.error('获取详情失败:', err);
        setError(err instanceof Error ? err.message : '获取详情失败');
      } finally {
        setLoading(false);
      }
    };

    // 提取 TMDB 数据获取逻辑为独立函数
    const fetchTmdbData = async () => {
      setCurrentSource('tmdb');
      const { searchTitle, extractedSeasonNumber } = parseTmdbSearchInfo();

      const searchResponse = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(searchTitle)}`
      );
      if (!searchResponse.ok) {
        throw new Error('搜索失败');
      }
      const searchData = await searchResponse.json();

      if (searchData.results && searchData.results.length > 0) {
        // 保存全部搜索结果,供纠错切换
        setTmdbResults(searchData.results);
        const best = pickBestTmdbResult(searchData.results, {
          mediaTypeHint: getMediaTypeHint(),
          year,
        });
        await applyTmdbResult(best, extractedSeasonNumber);
        return;
      }

      throw new Error('未找到相关内容');
    };

    fetchDetail();
  }, [
    isOpen,
    doubanId,
    bangumiId,
    isBangumi,
    tmdbId,
    title,
    type,
    year,
    seasonNumber,
    poster,
    cmsData,
    sourceId,
    source,
    isUsingTmdb,
  ]);

  // 切换数据源的函数
  const handleToggleSource = async () => {
    if (currentSource === 'tmdb') {
      // 切换回原始数据源
      if (originalDetailData) {
        setDetailData(originalDetailData);
        setCurrentSource(originalSource);
        setError(null);
      }
    } else {
      // 切换到 TMDB
      // 保存当前数据
      if (detailData && !originalDetailData) {
        setOriginalDetailData(detailData);
      }

      setLoading(true);
      setError(null);
      try {
        await fetchTmdbDataForToggle();
      } catch (err) {
        console.error('切换到TMDB失败:', err);
        setError(err instanceof Error ? err.message : '切换到TMDB失败');
        // 切换失败，但保持 currentSource 为 tmdb，这样可以显示切换回按钮
        setCurrentSource('tmdb');
      } finally {
        setLoading(false);
      }
    }
  };

  // 用于切换时获取 TMDB 数据
  const fetchTmdbDataForToggle = async () => {
    const { searchTitle, extractedSeasonNumber } = parseTmdbSearchInfo();

    const searchResponse = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(searchTitle)}`
      );
    if (!searchResponse.ok) {
      throw new Error('搜索失败');
    }
    const searchData = await searchResponse.json();

    if (searchData.results && searchData.results.length > 0) {
      // 保存全部搜索结果,供纠错切换
      setTmdbResults(searchData.results);
      const best = pickBestTmdbResult(searchData.results, {
          mediaTypeHint: getMediaTypeHint(),
          year,
        });
      await applyTmdbResult(best, extractedSeasonNumber);
      return;
    }

    throw new Error('未找到相关内容');
  };

  // 异步获取季度和集数详情（仅TMDB）
  useEffect(() => {
    if (
      !detailData?.tmdbId ||
      !detailData?.mediaType ||
      detailData.mediaType !== 'tv' ||
      seasonsLoaded
    ) {
      return;
    }

    const fetchSeasonData = async () => {
      setLoadingSeasons(true);
      try {
        // 获取所有季度
        const seasonsResponse = await fetch(
          `/api/tmdb/seasons?tvId=${detailData.tmdbId}`
        );
        if (!seasonsResponse.ok) return;
        const seasonsData = await seasonsResponse.json();
        const seasons: any[] = seasonsData.seasons || [];

        // 计算默认选中季度：优先用标题提取的季度号，
        // 若该季度号不在实际季度列表中，则降级到第一个有效季度
        const preferredSeason = detailData.seasonNumber || 1;
        const hasPreferred = seasons.some(
          (s: any) => s.season_number === preferredSeason
        );
        const defaultSeason = hasPreferred
          ? preferredSeason
          : seasons[0]?.season_number ?? preferredSeason;
        setSelectedSeason(defaultSeason);

        // 获取默认季度的集数详情
        const episodesResponse = await fetch(
          `/api/tmdb/episodes?id=${detailData.tmdbId}&season=${defaultSeason}`
        );
        const episodesData = episodesResponse.ok
          ? await episodesResponse.json()
          : null;

        // 即使集数获取失败，也保留季度列表，避免整个区块消失
        setSeasonData({
          seasons,
          episodes: episodesData?.episodes || [],
        });
        setSeasonsLoaded(true);
      } catch (err) {
        console.error('获取季度和集数详情失败:', err);
      } finally {
        setLoadingSeasons(false);
      }
    };

    fetchSeasonData();
  }, [
    detailData?.tmdbId,
    detailData?.mediaType,
    detailData?.seasonNumber,
    seasonsLoaded,
  ]);

  // 自动滚动到当前集数
  useEffect(() => {
    if (
      !currentEpisode ||
      !seasonData?.episodes ||
      !episodesScrollRef.current ||
      currentSource !== 'tmdb'
    ) {
      return;
    }

    // 等待 DOM 更新后再滚动
    const timer = setTimeout(() => {
      const episodeElement = document.getElementById(
        `episode-${currentEpisode}`
      );
      if (episodeElement && episodesScrollRef.current) {
        // 计算滚动位置，使当前集数居中显示
        const container = episodesScrollRef.current;
        const elementLeft = episodeElement.offsetLeft;
        const elementWidth = episodeElement.offsetWidth;
        const containerWidth = container.offsetWidth;
        const scrollLeft = elementLeft - containerWidth / 2 + elementWidth / 2;

        container.scrollLeft = scrollLeft;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentEpisode, seasonData?.episodes, currentSource]);

  // 异步获取演职人员信息（仅TMDB）
  useEffect(() => {
    if (
      !detailData?.tmdbId ||
      !detailData?.mediaType ||
      currentSource !== 'tmdb'
    ) {
      return;
    }

    // 如果已经有演员信息，不重复获取
    if (detailData.actors && detailData.actors.length > 0) {
      return;
    }

    const fetchCredits = async () => {
      try {
        const creditsResponse = await fetch(
          `/api/tmdb/credits?id=${detailData.tmdbId}&type=${detailData.mediaType}`
        );
        if (!creditsResponse.ok) return;
        const creditsData = await creditsResponse.json();

        // 更新演员和导演信息
        setDetailData((prev) =>
          prev
            ? {
                ...prev,
                directors:
                  creditsData.crew
                    ?.filter((person: any) => person.job === 'Director')
                    .slice(0, 5)
                    .map((person: any) => ({
                      name: person.name,
                      profile_path: person.profile_path,
                    })) || prev.directors,
                actors:
                  creditsData.cast?.slice(0, 15).map((person: any) => ({
                    name: person.name,
                    character: person.character,
                    profile_path: person.profile_path,
                  })) || prev.actors,
              }
            : null
        );
      } catch (err) {
        console.error('获取演职人员信息失败:', err);
      }
    };

    fetchCredits();
  }, [
    detailData?.tmdbId,
    detailData?.mediaType,
    currentSource,
    detailData?.actors,
  ]);

  // 切换季度时获取集数
  const handleSeasonChange = async (seasonNumber: number) => {
    if (!detailData?.tmdbId || selectedSeason === seasonNumber) return;

    setSelectedSeason(seasonNumber);
    setLoadingSeasons(true);
    try {
      const episodesResponse = await fetch(
        `/api/tmdb/episodes?id=${detailData.tmdbId}&season=${seasonNumber}`
      );
      if (!episodesResponse.ok) return;
      const episodesData = await episodesResponse.json();

      // 从当前 seasonData 中查找季度信息
      const season = seasonData?.seasons.find(
        (s: any) => s.season_number === seasonNumber
      );

      setSeasonData((prev) => ({
        seasons: prev?.seasons || [],
        episodes: episodesData.episodes || [],
      }));

      // 更新季度元信息
      setDetailData((prev) =>
        prev
          ? {
              ...prev,
              title:
                episodesData.name || season?.name
                  ? `${prev.seriesTitle || prev.title} ${
                      episodesData.name || season?.name
                    }`
                  : prev.title,
              intro: episodesData.overview || season?.overview || prev.overview,
              poster: season?.poster_path
                ? getTMDBImageUrl(season.poster_path, 'w500')
                : prev.poster,
              releaseDate:
                episodesData.air_date || season?.air_date || prev.releaseDate,
              year:
                episodesData.air_date?.substring(0, 4) ||
                season?.air_date?.substring(0, 4) ||
                prev.year,
              episodesCount:
                episodesData.episodes?.length ||
                season?.episode_count ||
                prev.episodesCount,
            }
          : null
      );

      setExpandedEpisodes(new Set());
    } catch (err) {
      console.error('获取集数详情失败:', err);
    } finally {
      setLoadingSeasons(false);
    }
  };

  // 拖动滚动处理函数
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!episodesScrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - episodesScrollRef.current.offsetLeft);
    setScrollLeft(episodesScrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !episodesScrollRef.current) return;

    const x = e.pageX - episodesScrollRef.current.offsetLeft;
    const distance = Math.abs(x - startX);

    // 只有移动超过5px才进入拖动模式
    if (distance > 5 && !isDragging) {
      setIsDragging(true);
      episodesScrollRef.current.style.cursor = 'grabbing';
      episodesScrollRef.current.style.userSelect = 'none';
    }

    if (isDragging) {
      e.preventDefault();
      const walk = (x - startX) * 2; // 滚动速度倍数
      episodesScrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setIsDragging(false);
    if (episodesScrollRef.current) {
      episodesScrollRef.current.style.cursor = 'grab';
      episodesScrollRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseLeave = () => {
    if (isMouseDown || isDragging) {
      setIsMouseDown(false);
      setIsDragging(false);
      if (episodesScrollRef.current) {
        episodesScrollRef.current.style.cursor = 'grab';
        episodesScrollRef.current.style.userSelect = 'auto';
      }
    }
  };

  // 演员列表拖动滚动处理函数
  const handleActorsMouseDown = (e: React.MouseEvent) => {
    if (!actorsScrollRef.current) return;
    setIsActorsMouseDown(true);
    setActorsStartX(e.pageX - actorsScrollRef.current.offsetLeft);
    setActorsScrollLeft(actorsScrollRef.current.scrollLeft);
  };

  const handleActorsMouseMove = (e: React.MouseEvent) => {
    if (!isActorsMouseDown || !actorsScrollRef.current) return;

    const x = e.pageX - actorsScrollRef.current.offsetLeft;
    const distance = Math.abs(x - actorsStartX);

    // 只有移动超过5px才进入拖动模式
    if (distance > 5 && !isActorsDragging) {
      setIsActorsDragging(true);
      actorsScrollRef.current.style.cursor = 'grabbing';
      actorsScrollRef.current.style.userSelect = 'none';
    }

    if (isActorsDragging) {
      e.preventDefault();
      const walk = (x - actorsStartX) * 2; // 滚动速度倍数
      actorsScrollRef.current.scrollLeft = actorsScrollLeft - walk;
    }
  };

  const handleActorsMouseUp = () => {
    setIsActorsMouseDown(false);
    setIsActorsDragging(false);
    if (actorsScrollRef.current) {
      actorsScrollRef.current.style.cursor = 'grab';
      actorsScrollRef.current.style.userSelect = 'auto';
    }
  };

  const handleActorsMouseLeave = () => {
    if (isActorsMouseDown || isActorsDragging) {
      setIsActorsMouseDown(false);
      setIsActorsDragging(false);
      if (actorsScrollRef.current) {
        actorsScrollRef.current.style.cursor = 'grab';
        actorsScrollRef.current.style.userSelect = 'auto';
      }
    }
  };

  const virtualGalleryLayout = React.useMemo(() => {
    if (galleryImages.length === 0 || galleryViewportWidth <= 0) {
      return {
        visibleItems: [] as Array<
          GalleryImage & {
            top: number;
            left: number;
            renderWidth: number;
            renderHeight: number;
            index: number;
          }
        >,
        totalHeight: 0,
        usedWidth: 0,
      };
    }

    const gap = 4;
    const overscan = 800;
    const horizontalPadding = 32;
    const width = Math.max(galleryViewportWidth - horizontalPadding, 0);
    const columnCount =
      width >= 1280 ? 5 : width >= 1024 ? 4 : width >= 640 ? 3 : 2;
    const columnWidth = Math.floor(
      (width - gap * (columnCount - 1)) / columnCount
    );
    const usedWidth = columnWidth * columnCount + gap * (columnCount - 1);
    const columnHeights = new Array(columnCount).fill(0);

    const items = galleryImages.map((image, index) => {
      let targetColumn = 0;
      for (let i = 1; i < columnCount; i++) {
        if (columnHeights[i] < columnHeights[targetColumn]) {
          targetColumn = i;
        }
      }

      const ratio =
        image.width && image.height
          ? image.height / image.width
          : image.imageType === 'poster'
          ? 1.5
          : 0.5625;
      const renderHeight = Math.max(Math.round(columnWidth * ratio), 80);
      const top = columnHeights[targetColumn];
      const left = targetColumn * (columnWidth + gap);

      columnHeights[targetColumn] += renderHeight + gap;

      return {
        ...image,
        index,
        top,
        left,
        renderWidth: columnWidth,
        renderHeight,
      };
    });

    const totalHeight = Math.max(...columnHeights, 0);
    const minVisibleTop = Math.max(galleryScrollTop - overscan, 0);
    const maxVisibleBottom =
      galleryScrollTop + galleryViewportHeight + overscan;
    const visibleItems = items.filter(
      (item) =>
        item.top + item.renderHeight >= minVisibleTop &&
        item.top <= maxVisibleBottom
    );

    return { visibleItems, totalHeight, usedWidth };
  }, [
    galleryImages,
    galleryScrollTop,
    galleryViewportHeight,
    galleryViewportWidth,
  ]);

  if (!isVisible || !mounted) return null;
  const actions = (
    <DetailActions
      onPlay={onPlay}
      onTogether={onTogether}
      onFavorite={onFavorite}
      favorited={favorited}
    />
  );
  const menuItems: DetailMenuItem[] = [];
  if (
    currentSource !== 'tmdb' ||
    (originalSource !== 'tmdb' && originalDetailData)
  ) {
    menuItems.push({
      label: '切换数据来源',
      description: `数据来源：${
        currentSource === 'douban'
          ? 'Douban'
          : currentSource === 'bangumi'
          ? 'Bangumi'
          : currentSource === 'cms'
          ? 'CMS'
          : 'TMDB'
      }`,
      action: handleToggleSource,
      disabled: loading,
    });
  }
  if (canShowGalleryEntry)
    menuItems.push({ label: '照片墙', action: openGallery });
  if (currentSource === 'tmdb' && tmdbResults.length > 1) {
    menuItems.push({
      label: '纠正匹配',
      action: () => setShowTmdbCorrection(true),
    });
  }
  if (externalUrl) {
    menuItems.push({
      label: '在新窗口打开',
      action: () => {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
      },
    });
  }
  const tools = (
    <DetailMoreMenu
      items={menuItems}
      gallery={{
        key: `${galleryTmdbId}:${galleryMediaType}`,
        loading: galleryLoading,
        total: galleryTotal,
        error: galleryError,
        open: showGallery,
      }}
    />
  );
  const content = (
    <>
      <DetailShell
        title={detailData?.title || title}
        returnFocusRef={returnFocusRef}
        visible={isAnimating}
        onClose={onClose}
        drawer={useDrawer}
        drawerWidth={drawerWidth}
        tools={tools}
        footer={
          <div className='tm-detail-mobile-actions tm-glass'>{actions}</div>
        }
      >
        <DetailContent
          key={title}
          title={title}
          data={detailData}
          loading={loading}
          error={error}
          backdrop={backdrop}
          onImageClick={handleImageClick}
          actions={actions}
          episodes={
            detailData && (
              <DetailEpisodes
                detailData={detailData}
                loadingSeasons={loadingSeasons}
                seasonData={seasonData}
                selectedSeason={selectedSeason}
                currentEpisode={currentEpisode}
                expandedEpisodes={expandedEpisodes}
                episodesScrollRef={episodesScrollRef}
                isDragging={isDragging}
                handleMouseDown={handleMouseDown}
                handleMouseMove={handleMouseMove}
                handleMouseUp={handleMouseUp}
                handleMouseLeave={handleMouseLeave}
                handleSeasonChange={handleSeasonChange}
                handleImageClick={handleImageClick}
                handleEpisodeStillsClick={handleEpisodeStillsClick}
                setExpandedEpisodes={setExpandedEpisodes}
              />
            )
          }
          actors={
            detailData && (
              <DetailActors
                detailData={detailData}
                currentSource={currentSource}
                actorsScrollRef={actorsScrollRef}
                handleActorsMouseDown={handleActorsMouseDown}
                handleActorsMouseMove={handleActorsMouseMove}
                handleActorsMouseUp={handleActorsMouseUp}
                handleActorsMouseLeave={handleActorsMouseLeave}
                isActorsDragging={isActorsDragging}
                handleImageClick={handleImageClick}
              />
            )
          }
        />
      </DetailShell>
      {showGallery && (
        <DetailShell
          title='照片墙'
          kind='gallery'
          onClose={() => setShowGallery(false)}
          drawer={useDrawer}
          drawerWidth={drawerWidth}
        >
          <p className='tm-detail-aux-title'>
            照片墙{!galleryLoading && ' · ' + galleryTotal + ' 张'}
          </p>
          <GalleryContent
            galleryScrollRef={galleryScrollRef}
            galleryLoading={galleryLoading}
            galleryError={galleryError}
            galleryImages={galleryImages}
            virtualGalleryLayout={virtualGalleryLayout}
            detailData={detailData}
            title={title}
            handleImageClick={handleImageClick}
          />
        </DetailShell>
      )}
      {showEpisodeStills && (
        <DetailShell
          title={episodeStillsTitle}
          kind='auxiliary'
          onClose={() => setShowEpisodeStills(false)}
          drawer={useDrawer}
          drawerWidth={drawerWidth}
        >
          <p className='tm-detail-aux-title'>{episodeStillsTitle}</p>
          <StillsContent
            episodeStillsLoading={episodeStillsLoading}
            episodeStillsError={episodeStillsError}
            episodeStills={episodeStills}
            episodeStillsTitle={episodeStillsTitle}
            handleImageClick={handleImageClick}
          />
        </DetailShell>
      )}
      {showTmdbCorrection && (
        <DetailShell
          title='纠正匹配'
          kind='auxiliary'
          onClose={() => setShowTmdbCorrection(false)}
          drawer={useDrawer}
          drawerWidth={drawerWidth}
        >
          <p className='tm-detail-aux-title'>选择正确的条目</p>
          <CorrectionContent
            tmdbResults={tmdbResults}
            detailData={detailData}
            handleSelectTmdbResult={handleSelectTmdbResult}
          />
        </DetailShell>
      )}
      {showImageViewer && (
        <DetailShell
          title={(detailData?.title || title) + ' 海报'}
          kind='image'
          onClose={() => setShowImageViewer(false)}
        >
          <ProxyImage
            originalSrc={selectedImage}
            alt={detailData?.title || title}
            className='tm-detail-full-image'
            loading='eager'
          />
        </DetailShell>
      )}
    </>
  );
  return createPortal(content, document.body);
};
export default DetailPanel;
