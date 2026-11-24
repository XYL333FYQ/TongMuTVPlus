/*
 * 自己看：换源搜索的纯计算——标题归一、判断电影 / 剧集、聚合兜底推荐、搜索结果缓存、按当前片过滤。
 * 从 load-source-detail 拆出来，不依赖 React 状态。
 */

import { logger } from '@/lib/logger';
import { type SettingKey, readSetting, writeSetting } from '@/lib/settings';
import { isSpecialSourceContext } from '@/lib/special-source.client';
import { SearchResult } from '@/lib/types';

import type { FallbackRecommendation, SearchCachePayload } from '../page/types';

// 规范化标题用于聚合（去除特殊符号、括号、空格和全角空格）
export const normalizeTitle = (title: string) => {
  return title
    .replace(/[\s\u3000]/g, '') // 去除空格和全角空格
    .replace(/[()（）[\]【】{}「」『』<>《》]/g, '') // 去除各种括号
    .replace(/[^\w\u4e00-\u9fa5]/g, ''); // 去除特殊符号，保留字母、数字、下划线和中文
};

// 辅助函数：获取视频类型
export const getType = (item: SearchResult): 'movie' | 'tv' => {
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

export const buildFallbackRecommendations = (
  items: SearchResult[],
  query: string,
  searchType: string
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
        emitGroup(`${preliminaryKey}-${year}`, [...yearGroup, ...withoutYear]);
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

export const readSearchCache = (query: string): SearchCachePayload | null => {
  if (typeof window === 'undefined' || !query.trim()) {
    return null;
  }

  try {
    const cacheKey: SettingKey = `search_cache_${query.trim()}${
      isSpecialSourceContext() ? '_special' : ''
    }`;
    const cached = readSetting(cacheKey);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as SearchCachePayload;
    if (
      (parsed?.status === 'complete' || parsed?.status === 'partial') &&
      Array.isArray(parsed.results)
    ) {
      return parsed;
    }
  } catch (error) {
    logger.error('[Play] 读取缓存失败:', error);
  }
  return null;
};

export const writeCompleteSearchCache = (
  query: string,
  results: SearchResult[]
) => {
  if (typeof window === 'undefined' || !query.trim()) return;

  try {
    const cacheKey: SettingKey = `search_cache_${query.trim()}${
      isSpecialSourceContext() ? '_special' : ''
    }`;
    const payload: SearchCachePayload = {
      status: 'complete',
      results,
      query: query.trim(),
      updatedAt: Date.now(),
    };
    writeSetting(cacheKey, JSON.stringify(payload));
  } catch (error) {
    logger.error('[Play] 写入缓存失败:', error);
  }
};

export const filterSourcesForVideo = (
  items: SearchResult[],
  videoTitle: string,
  videoYear: string,
  searchType: string
): SearchResult[] => {
  return items.filter(
    (result: SearchResult) =>
      normalizeTitle(result.title).toLowerCase() ===
        normalizeTitle(videoTitle).toLowerCase() &&
      (videoYear
        ? result.year.toLowerCase() === videoYear.toLowerCase() ||
          !result.year ||
          result.year.trim() === '' ||
          result.year === 'unknown' ||
          !/^\d{4}$/.test(result.year)
        : true) &&
      (searchType ? getType(result) === searchType : true)
  );
};
