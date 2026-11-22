/*
 * 自己看：选集面板里每一集的名字。两个来源：弹幕库的分集标题、TMDB 的分集名。
 * 单季动漫弹幕优先，其他（非动漫、多季度）TMDB 优先；用户在“纠错”里可以手动指定。
 */

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import { isAnimeCategoryText } from '@/lib/anime-keyword-expr';
import { cleanEpisodeDisplayName } from '@/lib/danmaku/format';
import type { EpisodeTitleCorrection } from '@/lib/episode-title-correction';
import type { SearchResult } from '@/lib/types';

import type { DanmakuState } from '@/features/player';

interface UseEpisodeNamesOptions {
  detail: SearchResult | null;
  videoTitle: string;
  isDirectPlay: boolean;
  totalEpisodes: number;
  titleCorrection: EpisodeTitleCorrection;
  episodeTitleFetchDisabled: boolean;
  danmakuState: DanmakuState;
  /** TMDB 背景请求解析出的剧集（形如 "tv:123"），分集名复用它 */
  resolvedTmdbIdStr: string | null;
  tmdbEpisodeNames: string[];
  setTmdbEpisodeNames: Dispatch<SetStateAction<string[]>>;
  /** 已经拉过的“剧集#季”，避免重复请求 */
  tmdbEpisodesFetchedIdRef: MutableRefObject<string | null>;
}

export function useEpisodeNames({
  detail,
  videoTitle,
  isDirectPlay,
  totalEpisodes,
  titleCorrection,
  episodeTitleFetchDisabled,
  danmakuState,
  resolvedTmdbIdStr,
  tmdbEpisodeNames,
  setTmdbEpisodeNames,
  tmdbEpisodesFetchedIdRef,
}: UseEpisodeNamesOptions) {
  // 复用背景请求解析出的 tmdbId，拉取该剧集当前季的分集名称（懒加载，按需触发）
  const loadTmdbEpisodeNames = useCallback(
    async (tmdbIdStr: string, seasonOverride?: number) => {
      try {
        const [mediaType, idPart] = tmdbIdStr.split(':');
        const id = parseInt(idPart, 10);
        if (mediaType !== 'tv' || !id) {
          return;
        }

        // 季度：优先手动指定，否则从标题解析，缺省第 1 季
        let seasonNumber = seasonOverride;
        if (!seasonNumber || seasonNumber < 1) {
          const seasonMatch =
            videoTitle?.match(/第\s*(\d+)\s*[季部]/) ||
            videoTitle?.match(/[Ss]eason\s*(\d+)/) ||
            videoTitle?.match(/\bS(\d+)\b/);
          const parsedSeason = seasonMatch ? parseInt(seasonMatch[1], 10) : NaN;
          seasonNumber =
            Number.isNaN(parsedSeason) || parsedSeason < 1 ? 1 : parsedSeason;
        }

        // 指纹含 id + 季，避免重复拉取；手动改季时可重新拉取
        const fingerprint = `${tmdbIdStr}#s${seasonNumber}`;
        if (tmdbEpisodesFetchedIdRef.current === fingerprint) {
          return;
        }
        tmdbEpisodesFetchedIdRef.current = fingerprint;

        const resp = await fetch(
          `/api/tmdb/episodes?id=${id}&season=${seasonNumber}`
        );
        if (!resp.ok) return;
        const season = await resp.json();
        const eps = season?.episodes;
        if (!Array.isArray(eps) || eps.length === 0) return;

        const names: string[] = [];
        eps.forEach((ep: { episode_number?: unknown; name?: string }) => {
          const num =
            typeof ep?.episode_number === 'number' ? ep.episode_number : NaN;
          if (!Number.isNaN(num) && num >= 1 && ep?.name) {
            names[num - 1] = String(ep.name);
          }
        });
        if (names.some((n) => n && n.trim() !== '')) {
          setTmdbEpisodeNames(names);
        }
      } catch (err) {
        console.error('获取TMDB分集名称失败:', err);
      }
    },
    // 后两个是页面传进来的 setState 和 ref，不会变
    [videoTitle, setTmdbEpisodeNames, tmdbEpisodesFetchedIdRef]
  );

  // 换剧时重置分集名相关状态
  useEffect(() => {
    tmdbEpisodesFetchedIdRef.current = null;
    setTmdbEpisodeNames([]);
  }, [videoTitle, setTmdbEpisodeNames, tmdbEpisodesFetchedIdRef]);

  // 是否为动漫内容（决定分集名来源优先级：动漫弹幕优先，非动漫 TMDB 优先）
  const isAnimeContent = useMemo(
    () => isAnimeCategoryText(detail?.type_name, detail?.class),
    [detail?.type_name, detail?.class]
  );

  // 分集标题里出现多个季度（SxxExx 中含 ≥2 个不同季号）时，弹幕（按番剧单季编号）无法跨季对齐、不可靠，
  // 此时无论是否动漫都改用 TMDB。
  const hasMultipleSeasons = useMemo(() => {
    const titles = detail?.episodes_titles;
    if (!titles || titles.length === 0) return false;
    const seasons = new Set<number>();
    for (const t of titles) {
      const m = t?.match(/[Ss](\d+)[Ee]\d+/);
      if (m) seasons.add(parseInt(m[1], 10));
      if (seasons.size >= 2) return true;
    }
    return false;
  }, [detail?.episodes_titles]);

  // 分集名是否 TMDB 优先：手动矫正优先（弹幕优先→false / 指定 TMDB→true），
  // 否则默认按类型：非动漫，或虽是动漫但含多个季度（弹幕不可靠）
  const preferTmdbNames = titleCorrection.preferDanmaku
    ? false
    : titleCorrection.tmdbId
    ? true
    : !isAnimeContent || hasMultipleSeasons;

  // 手动指定的 TMDB 剧集串（覆盖自动解析）
  const effectiveTmdbIdStr = titleCorrection.tmdbId
    ? `tv:${titleCorrection.tmdbId}`
    : resolvedTmdbIdStr;

  // 弹幕分集名（按番号对齐视频集，需完整分集列表；由 LRU 缓存或主动搜索提供）。
  // 去掉来源标记与集号后仍有实质内容才返回，否则返回 null（视为不可用）。
  const danmakuRichNames = useMemo<(string | undefined)[] | null>(() => {
    if (totalEpisodes <= 1) return null;
    if (episodeTitleFetchDisabled) return null;
    if (danmakuState.episodes.length === 0) return null;

    const extractEpNum = (title?: string): number | null => {
      if (!title) return null;
      const emby = title.match(/[Ss]\d+[Ee](\d+)/);
      if (emby) return parseInt(emby[1], 10);
      const zh = title.match(/^(\d+)$|第?\s*(\d+)\s*[集话話]?/);
      return zh ? parseInt(zh[1] || zh[2], 10) : null;
    };

    // 番号 -> 弹幕标题，便于按集数对齐；无番号时回退索引对齐
    const byNumber = new Map<number, string>();
    danmakuState.episodes.forEach((ep) => {
      const num = extractEpNum(ep.episodeTitle);
      if (num !== null && !byNumber.has(num)) {
        byNumber.set(num, ep.episodeTitle);
      }
    });

    const names: (string | undefined)[] = [];
    for (let i = 0; i < totalEpisodes; i += 1) {
      const videoNum = extractEpNum(detail?.episodes_titles?.[i]) ?? i + 1;
      const matched = byNumber.get(videoNum);
      const fallback = danmakuState.episodes[i]?.episodeTitle;
      const name = cleanEpisodeDisplayName(matched || fallback);
      names[i] = name || undefined;
    }
    return names.some((n) => n) ? names : null;
  }, [
    totalEpisodes,
    episodeTitleFetchDisabled,
    danmakuState.episodes,
    detail?.episodes_titles,
  ]);

  // 拉取 TMDB 分集名。TMDB 优先（非动漫或多季度动漫）：解析出 tmdbId 后即请求；
  // 弹幕优先（单季动漫）：先等弹幕自动装填「尘埃落定」，且仅在弹幕未产出可用标题时才降级拉 TMDB。
  // 手动「弹幕优先」时完全不搜 TMDB；手动指定 TMDB 时用指定的 id/季。
  useEffect(() => {
    if (isDirectPlay) return;
    if (episodeTitleFetchDisabled) return;
    if (titleCorrection.preferDanmaku) return; // 弹幕优先：不搜 TMDB
    if (!detail) return; // 等类型判定就绪，避免误判非动漫而抢先拉 TMDB
    if (!effectiveTmdbIdStr) return;
    if (!preferTmdbNames) {
      if (danmakuRichNames) return; // 弹幕已够用，无需 TMDB
      if (!danmakuState.settled) return; // 弹幕优先：先等弹幕落定再决定是否降级
    }
    loadTmdbEpisodeNames(effectiveTmdbIdStr, titleCorrection.season);
  }, [
    isDirectPlay,
    episodeTitleFetchDisabled,
    titleCorrection.preferDanmaku,
    titleCorrection.season,
    detail,
    effectiveTmdbIdStr,
    preferTmdbNames,
    danmakuRichNames,
    danmakuState.settled,
    loadTmdbEpisodeNames,
  ]);

  // TMDB 分集名。TMDB(zh-CN)对无本地化标题的集数会返回「第 N 集」占位，
  // 与弹幕一样用 cleanEpisodeDisplayName 去集号：整列去号后无实质内容视为无有效名字（null），
  // 避免占位名把选集面板误切到列表视图。
  // 起始集数（startEpisode）：视频第 1 集对应 TMDB 第 startEpisode 集，据此平移取名。
  const tmdbRichNames = useMemo<(string | undefined)[] | null>(() => {
    if (totalEpisodes <= 1) return null;
    if (episodeTitleFetchDisabled) return null;
    const offset = Math.max(1, titleCorrection.startEpisode ?? 1) - 1;
    const names = Array.from({ length: totalEpisodes }, (_, i) => {
      const cleaned = cleanEpisodeDisplayName(tmdbEpisodeNames[offset + i]);
      return cleaned || undefined;
    });
    return names.some((n) => n) ? names : null;
  }, [
    totalEpisodes,
    episodeTitleFetchDisabled,
    tmdbEpisodeNames,
    titleCorrection.startEpisode,
  ]);

  // 选集列表的分集名称。优先级：
  //   单季动漫：弹幕优先（可纠错性高、番剧标题更贴合），降级 TMDB
  //   非动漫 / 多季度动漫：TMDB 优先，降级弹幕
  const richEpisodeNames = useMemo<(string | undefined)[]>(() => {
    const ordered = preferTmdbNames
      ? [tmdbRichNames, danmakuRichNames]
      : [danmakuRichNames, tmdbRichNames];
    for (const names of ordered) {
      if (names) return names;
    }
    return [];
  }, [preferTmdbNames, danmakuRichNames, tmdbRichNames]);
  return richEpisodeNames;
}
