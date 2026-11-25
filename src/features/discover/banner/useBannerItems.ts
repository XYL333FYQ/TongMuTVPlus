'use client';

/*
 * 首页大图推荐的数据：先显示本机缓存（三种来源里最新的那份），过期或没有就后台拉新；
 * 下拉刷新时重新拉；豆瓣来源只给正在显示的那一条补预告片地址（不和播放抢网络）。
 */

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';

import { apiFetch } from '@/lib/api-client';
import { getDoubanDetail } from '@/lib/douban.client';
import { logger } from '@/lib/logger';
import { type SettingKey, readSetting, writeSetting } from '@/lib/settings';
import { usePageRefresh } from '@/hooks/usePageRefresh';

import type { BannerItem } from './banner-data';

const LOCALSTORAGE_DURATION = 24 * 60 * 60 * 1000;

export function useBannerItems({
  shouldLoad,
  previewAllowed,
  currentIndex,
  setCurrentIndex,
}: {
  shouldLoad: boolean;
  previewAllowed: boolean;
  currentIndex: number;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
}) {
  const [items, setItems] = useState<BannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<string>(''); // 当前数据源
  const trendingGeneration = useRef(0);
  useEffect(
    () => () => {
      trendingGeneration.current += 1;
    },
    []
  );

  // 根据数据源获取缓存key
  const getLocalStorageKey = (source: string): SettingKey =>
    `banner_trending_cache_${source}`;

  usePageRefresh(
    '/',
    async (signal) => {
      const generation = ++trendingGeneration.current;
      const response = await apiFetch('/api/tmdb/trending', {
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error('Banner refresh failed');
      const result = await response.json();
      if (signal.aborted || generation !== trendingGeneration.current) return;
      if (
        result.code !== 200 ||
        !Array.isArray(result.list) ||
        !result.list.length
      )
        throw new Error('No refreshed banner recommendations');
      const source = result.source || 'TMDB';
      setItems(result.list);
      setDataSource(source);
      setCurrentIndex((index) => Math.min(index, result.list.length - 1));
      setIsLoading(false);
      try {
        writeSetting(
          getLocalStorageKey(source),
          JSON.stringify({ data: result.list, timestamp: Date.now() })
        );
      } catch {
        // The existing optional cache must not turn a successful refresh into failure.
      }
    },
    shouldLoad
  );

  // 获取热门内容
  useEffect(() => {
    // 如果不应该加载，直接返回
    if (!shouldLoad) return;
    const generation = ++trendingGeneration.current;

    const fetchTrending = async () => {
      try {
        // 先尝试从所有可能的数据源缓存中读取，找到最新的缓存
        const sources = ['TMDB', 'TX', 'Douban'];
        let cachedData = null;
        let validSource = null;
        let cacheExpired = false;
        let latestTimestamp = 0;

        // 遍历所有数据源，找到最新的缓存
        for (const source of sources) {
          const cacheKey = getLocalStorageKey(source);
          const cached = readSetting(cacheKey);

          if (cached) {
            try {
              const { data, timestamp } = JSON.parse(cached);

              // 选择时间戳最新的缓存
              if (timestamp > latestTimestamp) {
                cachedData = data;
                validSource = source;
                latestTimestamp = timestamp;
                cacheExpired = Date.now() - timestamp > LOCALSTORAGE_DURATION;
              }
            } catch {
              // 缓存坏了就当没有，下面会重新拉
            }
          }
        }

        // 乐观缓存：如果有缓存（无论是否过期），先显示缓存数据
        if (cachedData) {
          setItems(cachedData);
          setDataSource(validSource || ''); // 设置数据源
          setIsLoading(false);
        }

        // 如果缓存过期或没有缓存，后台更新数据
        if (!cachedData || cacheExpired) {
          const response = await apiFetch('/api/tmdb/trending');
          const result = await response.json();
          if (generation !== trendingGeneration.current) return;

          if (result.code === 200 && result.list.length > 0) {
            const newDataSource = result.source || 'TMDB'; // 获取数据源标识
            const cacheKey = getLocalStorageKey(newDataSource);

            setItems(result.list);
            setDataSource(newDataSource); // 设置数据源

            // 保存到 localStorage（使用数据源特定的key）
            try {
              writeSetting(
                cacheKey,
                JSON.stringify({
                  data: result.list,
                  timestamp: Date.now(),
                })
              );
            } catch {
              // localStorage 可能已满，不缓存也能用
            }
          }
        }
      } catch (error) {
        if (generation === trendingGeneration.current) {
          // 拉不到就显示“暂时没有推荐内容”，原始错误留给排查
          logger.error('获取热门内容失败:', error);
        }
      } finally {
        if (generation === trendingGeneration.current) setIsLoading(false);
      }
    };

    fetchTrending();
  }, [shouldLoad]);

  // Only resolve a trailer for the visible item. Browsing must not compete
  // with the persistent film or room playback session.
  useEffect(() => {
    const item = items[currentIndex];
    if (
      !previewAllowed ||
      dataSource !== 'Douban' ||
      !item ||
      item.trailer_url !== undefined
    )
      return;
    let cancelled = false;
    getDoubanDetail(item.id.toString())
      .then((detail) => {
        if (cancelled) return;
        const trailerUrl = detail.trailers?.[0]?.video_url || null;
        setItems((previous) =>
          previous.map((entry) =>
            entry.id === item.id ? { ...entry, trailer_url: trailerUrl } : entry
          )
        );
      })
      .catch(() => {
        if (!cancelled)
          setItems((previous) =>
            previous.map((entry) =>
              entry.id === item.id ? { ...entry, trailer_url: null } : entry
            )
          );
      });
    return () => {
      cancelled = true;
    };
  }, [previewAllowed, dataSource, currentIndex, items]);

  return { items, dataSource, isLoading };
}
