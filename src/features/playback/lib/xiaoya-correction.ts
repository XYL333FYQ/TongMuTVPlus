/*
 * 小雅源的纠错信息（用户在“纠错”里选的 TMDB / 豆瓣条目），存在本机，播放页读出来覆盖片源信息。
 */

import { type SettingKey, readSetting } from '@/lib/settings';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import type { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

export interface XiaoyaCorrection {
  title?: string;
  posterPath?: string;
  releaseDate?: string;
  overview?: string;
  voteAverage?: number;
  tmdbId?: number;
  doubanId?: string | number;
  mediaType?: 'movie' | 'tv';
}

/** 从 localStorage 读取小雅源的纠错信息 */
export const getXiaoyaCorrection = (
  source: string,
  id: string
): XiaoyaCorrection | null => {
  try {
    const storageKey: SettingKey = `xiaoya_correction_${source}_${id}`;
    const correctionJson = readSetting(storageKey);
    if (correctionJson) {
      return JSON.parse(correctionJson);
    }
  } catch {
    // 读不出来就当没有纠错
  }
  return null;
};

/** 应用纠错信息到 detail 对象 */
export const applyCorrection = (
  detail: SearchResult,
  correction: XiaoyaCorrection
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

/** 批量应用纠错信息到源列表 */
export const applyCorrectionsToSources = (
  sources: SearchResult[]
): SearchResult[] => {
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
