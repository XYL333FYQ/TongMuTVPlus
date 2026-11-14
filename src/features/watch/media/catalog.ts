/*
 * 片源目录：搜索全部片源、取单个片源详情、按标题年份类型筛出“同一部影片”的各条线路，
 * 搜不到时给出相近推荐。搜索结果缓存在 sessionStorage（与搜索页共用）。
 */

import {
  appendSpecialSourceParam,
  isSpecialSourceContext,
} from '@/lib/special-source.client';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import type { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

export type MediaKind = 'movie' | 'tv';

export function normalizeTitle(title: string) {
  return (title || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[()（）[\]【】{}「」『』<>《》]/g, '')
    .replace(/[^\w一-龥]/g, '')
    .toLowerCase();
}

export function mediaKind(item: SearchResult): MediaKind {
  if (
    item.source === 'emby' ||
    item.source?.startsWith('emby_') ||
    item.source === 'openlist'
  )
    return item.type_name === '电影' ? 'movie' : 'tv';
  const type = item.type_name?.toLowerCase() || '';
  if (
    type.includes('电影') ||
    type.includes('movie') ||
    (type.endsWith('片') && !type.includes('动漫'))
  )
    return 'movie';
  if (
    type.includes('剧') ||
    type.includes('动漫') ||
    type.includes('综艺') ||
    type.includes('anime')
  )
    return 'tv';
  if (/第\d+集|第\d+话|EP?\d+/i.test(item.episodes_titles?.[0] || ''))
    return 'tv';
  return item.episodes?.length === 1 ? 'movie' : 'tv';
}

const hasValidYear = (year?: string) => !!year && /^\d{4}$/.test(year.trim());

/** 同名、年份对得上（或片源没写年份）、类型一致 */
export function sameVideo(
  items: SearchResult[],
  wanted: { title: string; year?: string; kind?: MediaKind | '' }
) {
  const title = normalizeTitle(wanted.title);
  const year = wanted.year?.toLowerCase();
  return items.filter(
    (item) =>
      normalizeTitle(item.title) === title &&
      (!year || !hasValidYear(item.year) || item.year.toLowerCase() === year) &&
      (!wanted.kind || mediaKind(item) === wanted.kind)
  );
}

export type SeriesStatus = 'completed' | 'ongoing' | 'unknown';

export function seriesStatus(detail: SearchResult | null): SeriesStatus {
  if (!detail) return 'unknown';
  const remarks = detail.vod_remarks?.toLowerCase();
  if (remarks) {
    if (
      ['更新至', '连载', '第', '更新到'].some((word) => remarks.includes(word))
    )
      return 'ongoing';
    if (
      ['全', '完结', '大结局', 'end', '完'].some((word) =>
        remarks.includes(word)
      )
    )
      return 'completed';
  }
  if (detail.vod_total && detail.vod_total > 0 && detail.episodes?.length)
    return detail.episodes.length >= detail.vod_total ? 'completed' : 'ongoing';
  return 'unknown';
}

// ------------------------------------------------------------ 小雅纠错

interface Correction {
  title?: string;
  posterPath?: string;
  releaseDate?: string;
  overview?: string;
  voteAverage?: number;
  tmdbId?: number;
  doubanId?: string | number;
  mediaType?: 'movie' | 'tv';
}

export function xiaoyaCorrection(
  source: string,
  id: string
): Correction | null {
  try {
    const raw = localStorage.getItem(`xiaoya_correction_${source}_${id}`);
    return raw ? (JSON.parse(raw) as Correction) : null;
  } catch {
    return null;
  }
}

export function applyCorrection(
  detail: SearchResult,
  correction: Correction
): SearchResult {
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
}

export function withCorrections(items: SearchResult[]) {
  return items.map((item) => {
    if (item.source !== 'xiaoya') return item;
    const correction = xiaoyaCorrection(item.source, item.id);
    return correction ? applyCorrection(item, correction) : item;
  });
}

// ------------------------------------------------------------ 网络

interface SearchCache {
  status: 'complete' | 'partial';
  results: SearchResult[];
  query: string;
  updatedAt: number;
}

function cacheKey(query: string) {
  return `search_cache_${query.trim()}${
    isSpecialSourceContext() ? '_special' : ''
  }`;
}

export function readSearchCache(query: string): SearchCache | null {
  if (!query.trim()) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SearchCache;
    return (parsed?.status === 'complete' || parsed?.status === 'partial') &&
      Array.isArray(parsed.results)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeSearchCache(query: string, results: SearchResult[]) {
  if (!query.trim()) return;
  try {
    sessionStorage.setItem(
      cacheKey(query),
      JSON.stringify({
        status: 'complete',
        results,
        query: query.trim(),
        updatedAt: Date.now(),
      })
    );
  } catch {
    // 存储满了也没关系
  }
}

export async function fetchSourceDetail(
  source: string,
  id: string,
  title: string,
  fileName?: string
): Promise<SearchResult | null> {
  let url = appendSpecialSourceParam(
    `/api/source-detail?source=${source}&id=${id}&title=${encodeURIComponent(
      title
    )}`
  );
  if (fileName) url += `&fileName=${encodeURIComponent(fileName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('获取视频详情失败');
  const detail = (await response.json()) as SearchResult | null;
  if (!detail) throw new Error('视频详情为空');
  return withCorrections([detail])[0];
}

/** 全站搜索（先用缓存）；返回全部结果，由调用方筛选 */
export async function searchEverything(
  query: string,
  onCached?: (results: SearchResult[]) => void
): Promise<{ results: SearchResult[]; complete: boolean }> {
  const cached = readSearchCache(query);
  if (cached) {
    onCached?.(cached.results);
    if (cached.status === 'complete')
      return { results: cached.results, complete: true };
  }
  try {
    const response = await fetch(
      appendSpecialSourceParam(
        `/api/search?q=${encodeURIComponent(query.trim())}`
      )
    );
    if (!response.ok) throw new Error('搜索失败');
    const data = (await response.json()) as { results?: SearchResult[] };
    const results = data.results || [];
    writeSearchCache(query, results);
    return { results, complete: true };
  } catch (error) {
    if (cached) return { results: cached.results, complete: false };
    throw error;
  }
}

// ------------------------------------------------------------ 搜不到时的推荐

export interface FallbackRecommendation {
  key: string;
  item: SearchResult;
  episodes?: number;
  sourceNames: string[];
  doubanId?: number;
}

function majority<T>(values: T[]) {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  let best: T | undefined;
  let votes = 0;
  counts.forEach((count, value) => {
    if (count > votes) {
      votes = count;
      best = value;
    }
  });
  return best;
}

/** 按“标题 + 类型 + 年份”合并，挑出最像用户要找的 12 部 */
export function fallbackRecommendations(
  items: SearchResult[],
  query: string,
  kind?: MediaKind | ''
): FallbackRecommendation[] {
  const typed = kind ? items.filter((item) => mediaKind(item) === kind) : items;
  const groups = new Map<string, SearchResult[]>();
  typed.forEach((item) => {
    const key = `${normalizeTitle(item.title)}-${mediaKind(item)}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  const output: FallbackRecommendation[] = [];
  groups.forEach((group, key) => {
    const byYear = new Map<string, SearchResult[]>();
    const noYear: SearchResult[] = [];
    group.forEach((item) => {
      if (hasValidYear(item.year))
        byYear.set(item.year, [...(byYear.get(item.year) || []), item]);
      else noYear.push(item);
    });
    const emit = (groupKey: string, merged: SearchResult[]) => {
      const representative = [...merged].sort(
        (a, b) =>
          (b.poster ? 1 : 0) - (a.poster ? 1 : 0) ||
          (b.weight ?? 0) - (a.weight ?? 0)
      )[0];
      output.push({
        key: groupKey,
        item: representative,
        episodes:
          majority(
            merged.map((item) => item.episodes?.length || 0).filter(Boolean)
          ) || undefined,
        sourceNames: Array.from(
          new Set(merged.map((item) => item.source_name).filter(Boolean))
        ),
        doubanId: majority(
          merged.map((item) => item.douban_id || 0).filter((id) => id > 0)
        ),
      });
    };
    if (byYear.size)
      byYear.forEach((yearGroup, year) =>
        emit(`${key}-${year}`, [...yearGroup, ...noYear])
      );
    else if (noYear.length) emit(`${key}-unknown`, noYear);
  });
  const wanted = normalizeTitle(query);
  return output
    .sort((a, b) => {
      const contains = (item: FallbackRecommendation) =>
        normalizeTitle(item.item.title).includes(wanted) ? 1 : 0;
      return (
        contains(b) - contains(a) ||
        b.sourceNames.length - a.sourceNames.length ||
        (b.item.weight ?? 0) - (a.item.weight ?? 0)
      );
    })
    .slice(0, 12);
}
