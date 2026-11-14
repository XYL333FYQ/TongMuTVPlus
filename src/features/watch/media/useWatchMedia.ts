'use client';

/*
 * 独立看的“放什么”：从播放地址参数解析出影片、找全部线路、测速选线、决定从哪一集哪一秒开始，
 * 以及换集、换线路、收藏、跳过片头片尾配置。和播放器无关，播放器只读它的结果。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { clearDanmakuCacheByTitle } from '@/lib/danmaku/api';
import {
  deleteFavorite,
  deleteSkipConfig,
  generateStorageKey,
  getAllPlayRecords,
  getEpisodeFilterConfig,
  getSkipConfig,
  isFavorited,
  migratePlayRecord,
  saveFavorite,
  savePlayRecord,
  saveSkipConfig,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import {
  isEpisodeHiddenByFilter,
  normalizeEpisodeFilterConfig,
} from '@/lib/episode-filter';
import {
  buildEpisodeProgressContentKey,
  loadLocalEpisodeProgress,
  pruneLocalEpisodeProgressStorage,
  saveLocalEpisodeProgress,
} from '@/lib/episode-progress';
import { normalizeNetdiskSource } from '@/lib/netdisk/source';
import type { EpisodeFilterConfig, SearchResult } from '@/lib/types';
import { base58Decode } from '@/lib/utils';
import { parsePlaybackEpisodeIndex } from '@/hooks/usePlaybackEpisode';

import {
  applyCorrection,
  FallbackRecommendation,
  fallbackRecommendations,
  fetchSourceDetail,
  MediaKind,
  readSearchCache,
  sameVideo,
  searchEverything,
  seriesStatus,
  withCorrections,
  xiaoyaCorrection,
} from './catalog';
import {
  preferBestSource,
  readPreferSettings,
  skipsSpeedTest,
  SpeedResult,
} from './prefer';
import type { SkipConfig } from '../player/plugins/playback-flow';
import { isLazyDetailSource } from '../player/source-policy';

export type LoadPhase =
  | 'search'
  | 'detail'
  | 'direct'
  | 'prefer'
  | 'ready'
  | 'error';

export interface WatchParams {
  source: string;
  id: string;
  title: string;
  year: string;
  searchTitle: string;
  searchType: MediaKind | '';
  prefer: boolean;
  episode: number | undefined;
  fileName: string;
  queueId: string;
  /** 短剧：不提示续播 */
  duanju: boolean;
}

export function parseWatchHref(href: string): WatchParams {
  const params = new URL(href || '/play', 'https://tongmu.invalid')
    .searchParams;
  const type = params.get('stype');
  return {
    source: normalizeNetdiskSource(params.get('source')) || '',
    id: params.get('id') || '',
    title: params.get('title') || '',
    year: params.get('year') || '',
    searchTitle: params.get('stitle') || '',
    searchType: type === 'movie' || type === 'tv' ? type : '',
    prefer: params.get('prefer') === 'true',
    episode: parsePlaybackEpisodeIndex(params.get('episode')),
    fileName: params.get('fileName') || '',
    queueId: params.get('queueId') || '',
    duanju: params.get('duanju') === '1',
  };
}

export interface ProgressSnapshot {
  time: number;
  duration: number;
}

export interface WatchMedia {
  params: WatchParams;
  phase: LoadPhase;
  error: string | null;
  detail: SearchResult | null;
  episodeIndex: number;
  sources: SearchResult[];
  sourcesLoading: boolean;
  sourcesError: string | null;
  speed: Map<string, SpeedResult>;
  recommendations: FallbackRecommendation[];
  favorited: boolean;
  skip: SkipConfig;
  episodeFilter: EpisodeFilterConfig | null;
  progressKey: string | null;
  /** 换集/换线后应该从哪一秒开始（播放器读取后清空） */
  takeResumeTime(): number | null;
  /** 用户主动切集：不显示“上次看到”提示 */
  suppressResumePrompt: boolean;
  changeEpisode(index: number): void;
  next(): boolean;
  previous(): boolean;
  hasNext: boolean;
  changeSource(source: string, id: string): Promise<void>;
  toggleFavorite(): Promise<void>;
  setSkip(config: SkipConfig): Promise<void>;
  setEpisodeFilter(config: EpisodeFilterConfig): void;
  saveProgress(snapshot: ProgressSnapshot): Promise<void>;
  saveLocalProgress(snapshot: ProgressSnapshot): void;
  /** 本集在播放记录里的时间点（续播提示） */
  recordedTime(): Promise<number | null>;
  /** 纠错成功后刷新标题封面 */
  refreshCorrection(): void;
  /** 补全网盘源的 TMDB 信息 */
  patchDetail(patch: Partial<SearchResult>): void;
}

const NO_SKIP: SkipConfig = { enable: false, intro_time: 0, outro_time: 0 };

export function useWatchMedia(options: {
  href: string;
  /** 地址栏需要更新（选定线路后），不触发重新加载 */
  replaceHref(href: string): void;
  snapshot(): ProgressSnapshot;
}): WatchMedia {
  const params = useMemo(() => parseWatchHref(options.href), [options.href]);
  const [phase, setPhase] = useState<LoadPhase>(() =>
    params.source === 'directplay'
      ? 'direct'
      : params.source && params.id
      ? 'detail'
      : 'search'
  );
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);
  const [episodeIndex, setEpisodeIndex] = useState(params.episode ?? 0);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<Map<string, SpeedResult>>(new Map());
  const [recommendations, setRecommendations] = useState<
    FallbackRecommendation[]
  >([]);
  const [favorited, setFavorited] = useState(false);
  const [skip, setSkipState] = useState<SkipConfig>(NO_SKIP);
  const [episodeFilter, setEpisodeFilter] =
    useState<EpisodeFilterConfig | null>(null);
  const [suppressResumePrompt, setSuppressResumePrompt] = useState(false);
  const resumeRef = useRef<number | null>(null);
  const detailRef = useRef<SearchResult | null>(null);
  const episodeRef = useRef(episodeIndex);
  const sourcesRef = useRef<SearchResult[]>([]);
  const lastSavedRef = useRef(-1);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  detailRef.current = detail;
  episodeRef.current = episodeIndex;
  sourcesRef.current = sources;

  const progressKey = useMemo(
    () =>
      buildEpisodeProgressContentKey({
        doubanId: detail?.douban_id,
        tmdbId: detail?.tmdb_id,
        title: params.searchTitle || params.title,
        year: params.year,
        searchType: params.searchType,
      }),
    [
      detail?.douban_id,
      detail?.tmdb_id,
      params.searchTitle,
      params.title,
      params.year,
      params.searchType,
    ]
  );
  const progressKeyRef = useRef(progressKey);
  progressKeyRef.current = progressKey;

  const commitHref = useCallback((detailData: SearchResult) => {
    const url = new URL(
      optionsRef.current.href || '/play',
      'https://tongmu.invalid'
    );
    url.searchParams.set('source', detailData.source);
    url.searchParams.set('id', detailData.id);
    if (detailData.source !== 'directplay') {
      url.searchParams.set('year', detailData.year || '');
      url.searchParams.set('title', detailData.title);
    }
    url.searchParams.delete('prefer');
    if (detailData.metadataSource !== 'file')
      url.searchParams.delete('fileName');
    optionsRef.current.replaceHref(`${url.pathname}${url.search}`);
  }, []);

  // ------------------------------------------------------------ 首次加载
  useEffect(() => {
    let cancelled = false;
    try {
      pruneLocalEpisodeProgressStorage();
    } catch {
      // 忽略
    }
    void getEpisodeFilterConfig()
      .then(
        (config) =>
          !cancelled &&
          setEpisodeFilter(normalizeEpisodeFilterConfig(config || undefined))
      )
      .catch(() => undefined);

    const query = params.searchTitle || params.title;
    const wanted = {
      title: params.title || query,
      year: params.year,
      kind: params.searchType,
    };

    const load = async () => {
      // 直链
      if (params.source === 'directplay') {
        let url = '';
        try {
          url = base58Decode(params.id);
        } catch {
          throw new Error('直链地址解析失败');
        }
        const direct: SearchResult = {
          id: params.id,
          title: params.title.trim() || '直链播放',
          poster: '',
          episodes: [url],
          episodes_titles: ['直链'],
          source: 'directplay',
          source_name: '直链',
          class: '',
          year: '',
          desc: '',
          type_name: '',
          douban_id: 0,
        };
        setSources([direct]);
        setSourcesLoading(false);
        return { chosen: direct };
      }
      if (!params.source && !params.id && !query)
        throw new Error('缺少要播放的影片');

      let chosen: SearchResult | null = null;
      let candidates: SearchResult[] = [];
      const background = () =>
        searchEverything(query, (cached) =>
          setRecommendations(
            fallbackRecommendations(cached, query, params.searchType)
          )
        )
          .then(({ results }) => {
            setRecommendations(
              fallbackRecommendations(results, query, params.searchType)
            );
            return withCorrections(sameVideo(results, wanted));
          })
          .catch((reason) => {
            setSourcesError(
              reason instanceof Error ? reason.message : '搜索失败'
            );
            return [] as SearchResult[];
          });

      if (params.source && params.id) {
        const cached = readSearchCache(query);
        const cachedSources = cached
          ? withCorrections(sameVideo(cached.results, wanted))
          : [];
        const hit = cachedSources.find(
          (item) => item.source === params.source && item.id === params.id
        );
        if (hit?.episodes?.length) {
          chosen = hit;
          candidates = cachedSources;
        } else {
          chosen = await fetchSourceDetail(
            params.source,
            params.id,
            query,
            params.source === 'xiaoya' ? params.fileName : undefined
          ).catch(() => null);
          if (chosen) candidates = [chosen];
        }
        setSources(candidates);
        setSourcesLoading(true);
        // 其余线路在后台补齐，不耽误开播
        void background().then((found) => {
          if (cancelled) return;
          const merged = [...candidates];
          found.forEach((item) => {
            if (
              !merged.some(
                (existing) =>
                  existing.source === item.source && existing.id === item.id
              )
            )
              merged.push(item);
          });
          setSources(merged);
          setSourcesLoading(false);
        });
        if (!params.prefer) {
          if (!chosen) throw new Error('没有找到这部影片');
          return { chosen };
        }
      } else {
        candidates = await background();
        setSources(candidates);
        setSourcesLoading(false);
      }

      if (!candidates.length && !chosen)
        throw new Error('没有找到可播放的线路');
      chosen = chosen || candidates[0];
      const prefer = readPreferSettings();
      if (prefer.enabled && candidates.length > 1) {
        setPhase('prefer');
        const testable = candidates.filter(
          (item) => !skipsSpeedTest(item.source)
        );
        if (testable.length) {
          const { best, results } = await preferBestSource(testable, prefer);
          if (cancelled) return null;
          setSpeed(results);
          chosen = best;
        } else chosen = candidates[0];
      }
      return { chosen };
    };

    (async () => {
      try {
        const result = await load();
        if (cancelled || !result) return;
        let chosen = result.chosen;
        if (isLazyDetailSource(chosen.source) && !chosen.episodes?.length)
          chosen =
            (await fetchSourceDetail(
              chosen.source,
              chosen.id,
              chosen.title || params.title
            )) || chosen;
        if (chosen.source === 'xiaoya') {
          const correction = xiaoyaCorrection(chosen.source, chosen.id);
          if (correction) chosen = applyCorrection(chosen, correction);
        }
        if (cancelled) return;
        // 从哪一集哪一秒开始
        const key = buildEpisodeProgressContentKey({
          doubanId: chosen.douban_id,
          tmdbId: chosen.tmdb_id,
          title: params.searchTitle || params.title,
          year: params.year,
          searchType: params.searchType,
        });
        const total = chosen.episodes?.length || 0;
        const requested =
          params.episode !== undefined
            ? Math.min(params.episode, Math.max(0, total - 1))
            : chosen.initialEpisodeIndex;
        let index = requested ?? 0;
        let resume: number | null = null;
        try {
          const record = (await getAllPlayRecords())[
            generateStorageKey(chosen.source, chosen.id)
          ];
          if (
            record &&
            (requested === undefined || record.index - 1 === requested)
          ) {
            index = record.index - 1;
            resume = record.play_time;
          } else resume = loadLocalEpisodeProgress(key, index);
        } catch {
          resume = loadLocalEpisodeProgress(key, index);
        }
        if (index < 0 || index >= total) index = 0;
        if (cancelled) return;
        resumeRef.current = resume;
        setSuppressResumePrompt(!!resume);
        setDetail(chosen);
        setEpisodeIndex(index);
        commitHref(chosen);
        setPhase('ready');
        void getSkipConfig(chosen.source, chosen.id)
          .then((config) => !cancelled && config && setSkipState(config))
          .catch(() => undefined);
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : '加载失败');
        setPhase('error');
        setSourcesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 每个 href 身份只加载一次：会话层会在换片时重建本 hook（key）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 收藏状态
  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    isFavorited(detail.source, detail.id)
      .then((value) => !cancelled && setFavorited(value))
      .catch(() => undefined);
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, unknown>) =>
        setFavorited(!!favorites[generateStorageKey(detail.source, detail.id)])
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [detail]);

  // ------------------------------------------------------------ 操作

  const saveLocalProgress = useCallback((snapshot: ProgressSnapshot) => {
    if (snapshot.time < 1 || !snapshot.duration) return;
    try {
      saveLocalEpisodeProgress(
        progressKeyRef.current,
        episodeRef.current,
        snapshot.time,
        snapshot.duration
      );
    } catch {
      // 忽略
    }
  }, []);

  const saveProgress = useCallback(
    async (snapshot: ProgressSnapshot) => {
      const current = detailRef.current;
      if (!current?.source_name || snapshot.time < 1 || !snapshot.duration)
        return;
      const seconds = Math.floor(snapshot.time);
      if (lastSavedRef.current === seconds) return;
      lastSavedRef.current = seconds;
      saveLocalProgress(snapshot);
      const { isAnimeCategoryText } = await import('@/lib/anime-keyword-expr');
      await savePlayRecord(current.source, current.id, {
        title: current.title,
        source_name: current.source_name,
        year: current.year,
        cover: current.poster || '',
        index: episodeRef.current + 1,
        total_episodes: current.episodes?.length || 1,
        play_time: seconds,
        total_time: Math.floor(snapshot.duration),
        save_time: Date.now(),
        search_title: params.searchTitle,
        is_anime: isAnimeCategoryText(current.type_name, current.class),
      }).catch(() => undefined);
    },
    [params.searchTitle, saveLocalProgress]
  );

  const goTo = useCallback(
    (index: number) => {
      const current = detailRef.current;
      if (!current || index < 0 || index >= (current.episodes?.length || 0))
        return false;
      if (index === episodeRef.current) return false;
      saveLocalProgress(optionsRef.current.snapshot());
      resumeRef.current = loadLocalEpisodeProgress(
        progressKeyRef.current,
        index
      );
      setSuppressResumePrompt(true);
      episodeRef.current = index;
      setEpisodeIndex(index);
      return true;
    },
    [saveLocalProgress]
  );

  const hidden = useCallback(
    (index: number) => {
      const title = detailRef.current?.episodes_titles?.[index];
      return !!title && isEpisodeHiddenByFilter(title, episodeFilter);
    },
    [episodeFilter]
  );

  const nextIndex = useCallback(() => {
    const total = detailRef.current?.episodes?.length || 0;
    for (let index = episodeRef.current + 1; index < total; index++)
      if (!hidden(index)) return index;
    return -1;
  }, [hidden]);

  const changeSource = useCallback(
    async (source: string, id: string) => {
      const current = detailRef.current;
      let next = sourcesRef.current.find(
        (item) => item.source === source && item.id === id
      );
      if (!next) return;
      if (isLazyDetailSource(next.source) && !next.episodes?.length) {
        const loaded = await fetchSourceDetail(source, id, next.title).catch(
          () => null
        );
        if (!loaded) throw new Error('获取视频详情失败，请重试');
        next = loaded;
      }
      if (next.source === 'xiaoya') {
        const correction = xiaoyaCorrection(next.source, next.id);
        if (correction) next = applyCorrection(next, correction);
      }
      const previousIndex = episodeRef.current;
      const oldCount = current?.episodes?.length || 0;
      const newCount = next.episodes?.length || 0;
      if (oldCount && newCount && oldCount !== newCount && current)
        void clearDanmakuCacheByTitle(current.title).catch(() => undefined);
      const index = previousIndex < newCount ? previousIndex : 0;
      const newKey = buildEpisodeProgressContentKey({
        doubanId: next.douban_id,
        tmdbId: next.tmdb_id,
        title: params.searchTitle || params.title,
        year: params.year,
        searchType: params.searchType,
      });
      const now = optionsRef.current.snapshot();
      const playing = now.time;
      let resume: number | null = null;
      if (index === previousIndex) {
        resume = playing > 1 ? playing : null;
        if (!resume && current) {
          const record = (
            await getAllPlayRecords().catch(() => ({} as Record<string, never>))
          )[generateStorageKey(current.source, current.id)] as
            | { index: number; play_time: number }
            | undefined;
          resume =
            record && record.index - 1 === index && record.play_time > 1
              ? record.play_time
              : loadLocalEpisodeProgress(progressKeyRef.current, index);
        }
      } else resume = loadLocalEpisodeProgress(newKey, index);
      // 跳过片头片尾配置跟着线路走
      if (current) {
        await deleteSkipConfig(current.source, current.id).catch(
          () => undefined
        );
        await saveSkipConfig(next.source, next.id, skip).catch(() => undefined);
      }
      if (index === previousIndex && resume && resume > 1 && current) {
        saveLocalEpisodeProgress(newKey, index, resume, now.duration);
        await migratePlayRecord(
          current.source,
          current.id,
          next.source,
          next.id,
          {
            title: next.title,
            source_name: next.source_name || '',
            year: next.year || '',
            cover: next.poster || '',
            index: index + 1,
            total_episodes: newCount || 1,
            play_time: Math.floor(resume),
            total_time: Math.floor(now.duration),
            save_time: Date.now(),
            search_title: params.searchTitle,
          }
        ).catch(() => undefined);
      }
      resumeRef.current = resume;
      setSuppressResumePrompt(true);
      detailRef.current = next;
      episodeRef.current = index;
      setDetail(next);
      setEpisodeIndex(index);
      commitHref(next);
    },
    [
      commitHref,
      params.searchTitle,
      params.title,
      params.year,
      params.searchType,
      skip,
    ]
  );

  const toggleFavorite = useCallback(async () => {
    const current = detailRef.current;
    if (!current) return;
    if (favorited) {
      await deleteFavorite(current.source, current.id);
      setFavorited(false);
    } else {
      await saveFavorite(current.source, current.id, {
        title: current.title,
        source_name: current.source_name || '',
        year: current.year || 'unknown',
        cover: current.poster || '',
        total_episodes: current.episodes?.length || 1,
        save_time: Date.now(),
        search_title: params.searchTitle,
        is_completed: seriesStatus(current) === 'completed',
        vod_remarks: current.vod_remarks,
      });
      setFavorited(true);
    }
  }, [favorited, params.searchTitle]);

  const setSkip = useCallback(async (config: SkipConfig) => {
    const current = detailRef.current;
    setSkipState(config);
    if (!current) return;
    if (!config.enable && !config.intro_time && !config.outro_time)
      await deleteSkipConfig(current.source, current.id).catch(() => undefined);
    else
      await saveSkipConfig(current.source, current.id, config).catch(
        () => undefined
      );
  }, []);

  const recordedTime = useCallback(async () => {
    const current = detailRef.current;
    if (!current) return null;
    const record = (await getAllPlayRecords())[
      generateStorageKey(current.source, current.id)
    ];
    return record && record.index - 1 === episodeRef.current
      ? record.play_time
      : null;
  }, []);

  const refreshCorrection = useCallback(() => {
    const current = detailRef.current;
    if (!current || current.source !== 'xiaoya') return;
    const correction = xiaoyaCorrection(current.source, current.id);
    if (!correction) return;
    setDetail(applyCorrection(current, correction));
    setSources((list) => withCorrections(list));
  }, []);

  const patchDetail = useCallback((patch: Partial<SearchResult>) => {
    setDetail((current) => (current ? { ...current, ...patch } : current));
  }, []);

  return {
    params,
    phase,
    error,
    detail,
    episodeIndex,
    sources,
    sourcesLoading,
    sourcesError,
    speed,
    recommendations,
    favorited,
    skip,
    episodeFilter,
    progressKey,
    takeResumeTime: () => {
      const value = resumeRef.current;
      resumeRef.current = null;
      return value;
    },
    suppressResumePrompt,
    changeEpisode: (index) => void goTo(index),
    next: () => {
      const index = nextIndex();
      return index >= 0 ? goTo(index) : false;
    },
    previous: () => goTo(episodeRef.current - 1),
    hasNext: detail ? nextIndex() >= 0 : false,
    changeSource,
    toggleFavorite,
    setSkip,
    setEpisodeFilter,
    saveProgress,
    saveLocalProgress,
    recordedTime,
    refreshCorrection,
    patchDetail,
  };
}
