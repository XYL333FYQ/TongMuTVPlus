/*
 * 自己看：取 TMDB 的剧照背景、海报、简介（useEffect 的回调）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { isNetdiskSource } from '@/lib/netdisk/source';
import {
  getRecommendationCache,
  recommendationCacheKeys,
  setRecommendationCache,
} from '@/lib/recommendations/cache';
import { readSetting } from '@/lib/settings';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

/** /api/tmdb-details 返回的内容（也原样存在推荐缓存里） */
export interface TmdbPlayDetails {
  /** 形如 "tv:123"；老缓存里可能是数字 */
  tmdbId: string | number;
  mediaType?: 'movie' | 'tv';
  title?: string;
  backdrop: string | null;
  poster: string | null;
  overview: string;
  /** 一位小数的评分文字，没有评分时为空 */
  rating: string;
  releaseDate: string;
  genres: Array<{ id?: number; name: string }>;
}

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface LoadTmdbBackdropContext {
  correctedDesc: string;
  detailRef: MutableRefObject<SearchResult | null>;
  isDirectPlay: boolean;
  setCorrectedDesc: Dispatch<SetStateAction<string>>;
  setDetail: Dispatch<SetStateAction<SearchResult | null>>;
  setDoubanCardSubtitle: Dispatch<SetStateAction<string>>;
  setDoubanRating: Dispatch<
    SetStateAction<{ value: number; count: number; star_count: number } | null>
  >;
  setDoubanYear: Dispatch<SetStateAction<string>>;
  setNetdiskTMDBMeta: Dispatch<
    SetStateAction<{
      desc?: string;
      poster?: string;
      year?: string;
      tmdbId?: number;
    } | null>
  >;
  setPendingNetdiskTMDBData: Dispatch<SetStateAction<TmdbPlayDetails | null>>;
  setResolvedTmdbIdStr: Dispatch<SetStateAction<string | null>>;
  setTmdbBackdrop: Dispatch<SetStateAction<string | null>>;
  setTmdbEpisodeNames: Dispatch<SetStateAction<string[]>>;
  setVideoCover: Dispatch<SetStateAction<string>>;
  setVideoYear: Dispatch<SetStateAction<string>>;
  videoDoubanId: number;
  videoTitle: string;
}

export function makeLoadTmdbBackdrop(ctx: LoadTmdbBackdropContext) {
  const {
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
  } = ctx;
  return () => {
    const fetchTMDBBackdrop = async () => {
      if (isDirectPlay) {
        setTmdbBackdrop(null);
        setTmdbEpisodeNames([]);
        setResolvedTmdbIdStr(null);
        return;
      }

      // 检查是否禁用背景图
      if (typeof window !== 'undefined') {
        const disabled = readSetting('tmdb_backdrop_disabled');
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
          const detailsCache =
            getRecommendationCache<TmdbPlayDetails>(detailsCacheKey);

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

        const result = (await response.json()) as TmdbPlayDetails;

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

    const populatePlayMetadataFromTMDB = (tmdbData: TmdbPlayDetails) => {
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
    const populateDoubanFieldsFromTMDB = (tmdbData: TmdbPlayDetails) => {
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
        const genreNames = tmdbData.genres.map((g) => g.name).join(' / ');
        setDoubanCardSubtitle(genreNames);
      } else if (tmdbData.mediaType && tmdbData.releaseDate) {
        // 兜底：如果没有genres，使用年份和类型
        const year = tmdbData.releaseDate.split('-')[0];
        const typeText = tmdbData.mediaType === 'movie' ? '电影' : '电视剧';
        setDoubanCardSubtitle(`${year} / ${typeText}`);
      }
    };

    fetchTMDBBackdrop();
  };
}
