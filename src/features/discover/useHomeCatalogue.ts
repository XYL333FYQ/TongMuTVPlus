'use client';

/*
 * 首页各内容模块的数据：先用本机缓存（一小时内算新），缺了或过期就拉；下拉刷新时只拉开着的模块。
 * 拉回来的每一块各自写回缓存；拉不到的几块留着旧数据。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BangumiCalendarData } from '@/lib/bangumi.client';
import {
  type HomeCatalogueData,
  HOME_CACHE_KEYS,
  HOME_MODULE_KEYS,
  loadHomeCatalogue,
} from '@/lib/home-catalogue';
import { logger } from '@/lib/logger';
import { type SettingKey, readSetting, writeSetting } from '@/lib/settings';
import type { TMDBItem } from '@/lib/tmdb.client';
import { type SearchResult, DoubanItem } from '@/lib/types';
import { usePageRefresh } from '@/hooks/usePageRefresh';

import type { HomeModule } from './useHomeLayoutSettings';

export function useHomeCatalogue(homeModules: HomeModule[]) {
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [hotDuanju, setHotDuanju] = useState<SearchResult[]>([]);
  const [upcomingContent, setUpcomingContent] = useState<TMDBItem[]>([]);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<
    BangumiCalendarData[]
  >([]);
  const [loading, setLoading] = useState(true);
  const homeLoadGeneration = useRef(0);
  const applyHomeCatalogue = useCallback((data: Partial<HomeCatalogueData>) => {
    if (data.movies) setHotMovies(data.movies);
    if (data.tvshows) setHotTvShows(data.tvshows);
    if (data.variety) setHotVarietyShows(data.variety);
    if (data.bangumi) setBangumiCalendarData(data.bangumi);
    if (data.duanju) setHotDuanju(data.duanju);
    if (data.upcoming) setUpcomingContent(data.upcoming);
    for (const key of Object.keys(
      HOME_CACHE_KEYS
    ) as (keyof HomeCatalogueData)[]) {
      if (!data[key]?.length) continue;
      try {
        writeSetting(
          HOME_CACHE_KEYS[key],
          JSON.stringify({ data: data[key], timestamp: Date.now() })
        );
      } catch {
        /* Optional catalogue cache must not block rendering. */
      }
    }
  }, []);
  useEffect(
    () => () => {
      homeLoadGeneration.current += 1;
    },
    []
  );
  usePageRefresh('/', async (signal) => {
    const generation = ++homeLoadGeneration.current;
    setLoading(false);
    const keys = homeModules
      .filter((module) => module.enabled)
      .map((module) => HOME_MODULE_KEYS[module.id])
      .filter(Boolean);
    const result = await loadHomeCatalogue(keys, signal);
    if (signal.aborted || generation !== homeLoadGeneration.current) return;
    applyHomeCatalogue(result.data);
    if (result.failed.length)
      throw new Error('Some homepage sections could not refresh');
  });

  useEffect(() => {
    const CACHE_DURATION = 60 * 60 * 1000; // 1小时

    const getCache = (key: SettingKey) => {
      try {
        const cached = readSetting(key);
        if (!cached) return null;
        const { data, timestamp } = JSON.parse(cached);
        return { data, expired: Date.now() - timestamp > CACHE_DURATION };
      } catch {
        return null;
      }
    };

    const moviesCache = getCache('homepage_movies');
    const tvShowsCache = getCache('homepage_tvshows');
    const varietyCache = getCache('homepage_variety');
    const bangumiCache = getCache('homepage_bangumi');
    const duanjuCache = getCache('homepage_duanju');
    const upcomingCache = getCache('homepage_upcoming');

    if (moviesCache?.data) setHotMovies(moviesCache.data);
    if (tvShowsCache?.data) setHotTvShows(tvShowsCache.data);
    if (varietyCache?.data) setHotVarietyShows(varietyCache.data);
    if (bangumiCache?.data) setBangumiCalendarData(bangumiCache.data);
    if (duanjuCache?.data) setHotDuanju(duanjuCache.data);
    if (upcomingCache?.data) setUpcomingContent(upcomingCache.data);

    const hasCache =
      moviesCache ||
      tvShowsCache ||
      varietyCache ||
      bangumiCache ||
      duanjuCache ||
      upcomingCache;
    if (hasCache) setLoading(false);

    const needsRefresh =
      !moviesCache ||
      moviesCache.expired ||
      !tvShowsCache ||
      tvShowsCache.expired ||
      !varietyCache ||
      varietyCache.expired ||
      !bangumiCache ||
      bangumiCache.expired ||
      !duanjuCache ||
      duanjuCache.expired ||
      !upcomingCache ||
      upcomingCache.expired;

    const generation = ++homeLoadGeneration.current;
    let cancelled = false;
    if (needsRefresh) {
      void loadHomeCatalogue().then((result) => {
        if (cancelled || generation !== homeLoadGeneration.current) return;
        applyHomeCatalogue(result.data);
        if (result.failed.length) {
          // 拿到的几块照常显示，没拿到的留给排查
          logger.error('首页部分内容暂时无法获取:', result.failed.join(', '));
        }
        setLoading(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [applyHomeCatalogue]);

  return {
    hotMovies,
    hotTvShows,
    hotVarietyShows,
    hotDuanju,
    upcomingContent,
    bangumiCalendarData,
    loading,
  };
}
