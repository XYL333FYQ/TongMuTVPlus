'use client';

/*
 * 影片附加信息：豆瓣评分 / 又名 / 年份，TMDB 背景图与分集名称（没有豆瓣时用 TMDB 评分）。
 * 分集名称优先级：用户纠正 → 非动漫或多季用 TMDB → 动漫优先用弹幕剧集名。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { isAnimeCategoryText } from '@/lib/anime-keyword-expr';
import { getCachedDanmakuEpisodes } from '@/lib/danmaku/episodes-cache';
import { cleanEpisodeDisplayName } from '@/lib/danmaku/format';
import { getDoubanDetail } from '@/lib/douban.client';
import {
  EPISODE_TITLE_CORRECTION_EVENT,
  EpisodeTitleCorrection,
  getEpisodeTitleCorrection,
} from '@/lib/episode-title-correction';
import {
  getRecommendationCache,
  recommendationCacheKeys,
  setRecommendationCache,
} from '@/lib/recommendations/cache';
import type { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import { episodeNumber } from '../player/plugins/danmaku';

export interface Rating {
  value: number;
  count: number;
}

export interface MediaMetadata {
  rating: Rating | null;
  subtitle: string;
  aka: string[];
  year: string;
  backdrop: string | null;
  /** 每集的好看名字（没有则为 undefined） */
  episodeNames: Array<string | undefined>;
  correction: EpisodeTitleCorrection;
  tmdb: TmdbDetails | null;
}

interface TmdbDetails {
  tmdbId?: string | number;
  backdrop?: string;
  poster?: string;
  overview?: string;
  rating?: string;
  releaseDate?: string;
  genres?: Array<{ name: string }>;
  mediaType?: string;
}

function flagDisabled(key: string) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** 弹幕剧集名按集号对上视频的集 */
export function namesFromDanmaku(
  danmakuEpisodes: Array<{ episodeTitle: string }>,
  videoTitles: string[] | undefined,
  total: number
) {
  if (total <= 1 || !danmakuEpisodes.length) return null;
  const byNumber = new Map<number, string>();
  danmakuEpisodes.forEach((ep) => {
    const number = episodeNumber(ep.episodeTitle);
    if (number !== null && !byNumber.has(number))
      byNumber.set(number, ep.episodeTitle);
  });
  const names = Array.from({ length: total }, (_, index) => {
    const number = episodeNumber(videoTitles?.[index]) ?? index + 1;
    return (
      cleanEpisodeDisplayName(
        byNumber.get(number) || danmakuEpisodes[index]?.episodeTitle
      ) || undefined
    );
  });
  return names.some(Boolean) ? names : null;
}

export function useMediaMetadata(options: {
  title: string;
  searchTitle: string;
  doubanId: number;
  detail: SearchResult | null;
  danmakuEpisodes: Array<{ episodeTitle: string }>;
  danmakuSettled: boolean;
  enabled: boolean;
}): MediaMetadata {
  const { title, doubanId, detail, enabled } = options;
  const [rating, setRating] = useState<Rating | null>(null);
  const [subtitle, setSubtitle] = useState('');
  const [aka, setAka] = useState<string[]>([]);
  const [year, setYear] = useState('');
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [tmdb, setTmdb] = useState<TmdbDetails | null>(null);
  const [tmdbNames, setTmdbNames] = useState<string[]>([]);
  const [correction, setCorrection] = useState<EpisodeTitleCorrection>({});
  const fetchedSeason = useRef<string | null>(null);

  useEffect(() => {
    const key = options.searchTitle || title;
    const sync = () => setCorrection(getEpisodeTitleCorrection(key));
    sync();
    window.addEventListener(EPISODE_TITLE_CORRECTION_EVENT, sync);
    return () =>
      window.removeEventListener(EPISODE_TITLE_CORRECTION_EVENT, sync);
  }, [options.searchTitle, title]);

  // 豆瓣
  useEffect(() => {
    setRating(null);
    setSubtitle('');
    setAka([]);
    setYear('');
    if (!enabled || !doubanId) return;
    let cancelled = false;
    getDoubanDetail(String(doubanId))
      .then((data) => {
        if (cancelled) return;
        if (data.rating)
          setRating({ value: data.rating.value, count: data.rating.count });
        if (data.card_subtitle) setSubtitle(data.card_subtitle);
        if (data.aka?.length) setAka(data.aka);
        const pub = data.pubdate?.[0]?.replace(/\([^)]*\)/g, '').trim();
        if (pub) setYear(pub);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doubanId, enabled]);

  // TMDB：背景图、没有豆瓣时的评分与类型
  useEffect(() => {
    setBackdrop(null);
    setTmdb(null);
    setTmdbNames([]);
    fetchedSeason.current = null;
    if (!enabled || !title || flagDisabled('tmdb_backdrop_disabled')) return;
    let cancelled = false;
    (async () => {
      const mappingKey = recommendationCacheKeys.tmdbTitleMapping(title);
      const cachedId = getRecommendationCache<string>(mappingKey);
      let details = cachedId
        ? getRecommendationCache<TmdbDetails>(
            recommendationCacheKeys.tmdbDetails(cachedId)
          )
        : null;
      if (!details) {
        const response = await fetch(
          cachedId
            ? `/api/tmdb-details?cachedId=${encodeURIComponent(cachedId)}`
            : `/api/tmdb-details?title=${encodeURIComponent(title)}`
        );
        if (!response.ok) return;
        details = (await response.json()) as TmdbDetails;
        if (details.tmdbId) {
          setRecommendationCache(mappingKey, String(details.tmdbId));
          setRecommendationCache(
            recommendationCacheKeys.tmdbDetails(String(details.tmdbId)),
            details
          );
        }
      }
      if (cancelled || !details) return;
      if (!details.tmdbId && cachedId)
        details = { ...details, tmdbId: cachedId };
      setTmdb(details);
      if (details.backdrop) setBackdrop(processImageUrl(details.backdrop));
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [title, enabled]);

  // 没有豆瓣时用 TMDB 补评分 / 年份 / 类型
  useEffect(() => {
    if (doubanId || !tmdb) return;
    if (tmdb.rating) setRating({ value: parseFloat(tmdb.rating), count: 0 });
    const tmdbYear = tmdb.releaseDate?.split('-')[0];
    if (tmdbYear) setYear(tmdbYear);
    if (tmdb.genres?.length)
      setSubtitle(tmdb.genres.map((genre) => genre.name).join(' / '));
    else if (tmdb.mediaType && tmdbYear)
      setSubtitle(
        `${tmdbYear} / ${tmdb.mediaType === 'movie' ? '电影' : '电视剧'}`
      );
  }, [doubanId, tmdb]);

  const total = detail?.episodes?.length || 0;
  const titleFetchDisabled =
    flagDisabled('disableEpisodeTitleFetch') || !!correction.disabled;
  const anime = isAnimeCategoryText(detail?.type_name, detail?.class);
  const multiSeason = useMemo(() => {
    const seasons = new Set<number>();
    for (const item of detail?.episodes_titles || []) {
      const match = item?.match(/[Ss](\d+)[Ee]\d+/);
      if (match) seasons.add(parseInt(match[1], 10));
      if (seasons.size >= 2) return true;
    }
    return false;
  }, [detail?.episodes_titles]);
  const preferTmdb = correction.preferDanmaku
    ? false
    : correction.tmdbId
    ? true
    : !anime || multiSeason;
  const tmdbId = correction.tmdbId
    ? `tv:${correction.tmdbId}`
    : tmdb?.tmdbId
    ? String(tmdb.tmdbId)
    : null;

  const danmakuEpisodes = options.danmakuEpisodes.length
    ? options.danmakuEpisodes
    : getCachedDanmakuEpisodes(title) || [];
  const danmakuNames = useMemo(
    () =>
      titleFetchDisabled
        ? null
        : namesFromDanmaku(danmakuEpisodes, detail?.episodes_titles, total),
    [titleFetchDisabled, danmakuEpisodes, detail?.episodes_titles, total]
  );

  // TMDB 分集名
  useEffect(() => {
    if (
      !enabled ||
      titleFetchDisabled ||
      correction.preferDanmaku ||
      !detail ||
      !tmdbId
    )
      return;
    if (!preferTmdb && (danmakuNames || !options.danmakuSettled)) return;
    const [type, rawId] = tmdbId.split(':');
    const id = parseInt(rawId, 10);
    if (type !== 'tv' || !id) return;
    let season = correction.season;
    if (!season || season < 1) {
      const match =
        title.match(/第\s*(\d+)\s*[季部]/) ||
        title.match(/[Ss]eason\s*(\d+)/) ||
        title.match(/\bS(\d+)\b/);
      season = match ? Math.max(1, parseInt(match[1], 10)) : 1;
    }
    const fingerprint = `${tmdbId}#s${season}`;
    if (fetchedSeason.current === fingerprint) return;
    fetchedSeason.current = fingerprint;
    fetch(`/api/tmdb/episodes?id=${id}&season=${season}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const names: string[] = [];
        (data?.episodes || []).forEach(
          (ep: { episode_number?: number; name?: string }) => {
            if (
              typeof ep.episode_number === 'number' &&
              ep.episode_number >= 1 &&
              ep.name
            )
              names[ep.episode_number - 1] = String(ep.name);
          }
        );
        if (names.some((name) => name?.trim())) setTmdbNames(names);
      })
      .catch(() => undefined);
  }, [
    enabled,
    titleFetchDisabled,
    correction.preferDanmaku,
    correction.season,
    detail,
    tmdbId,
    preferTmdb,
    danmakuNames,
    options.danmakuSettled,
    title,
  ]);

  const tmdbEpisodeNames = useMemo(() => {
    if (total <= 1 || titleFetchDisabled) return null;
    const offset = Math.max(1, correction.startEpisode ?? 1) - 1;
    const names = Array.from(
      { length: total },
      (_, i) => cleanEpisodeDisplayName(tmdbNames[offset + i]) || undefined
    );
    return names.some(Boolean) ? names : null;
  }, [total, titleFetchDisabled, tmdbNames, correction.startEpisode]);

  const episodeNames = useMemo(() => {
    const order = preferTmdb
      ? [tmdbEpisodeNames, danmakuNames]
      : [danmakuNames, tmdbEpisodeNames];
    return order.find(Boolean) || [];
  }, [preferTmdb, tmdbEpisodeNames, danmakuNames]);

  return {
    rating,
    subtitle,
    aka,
    year,
    backdrop,
    episodeNames,
    correction,
    tmdb,
  };
}
