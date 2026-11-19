/*
 * 弹幕：自动匹配弹幕源并加载、手动选择 / 搜索、上传、过滤、数量上限、下一集预加载。
 * 匹配顺序（与旧版一致）：本地缓存 → 手动选过的剧集 → 记住的番剧 → 关键词搜索（多个结果时用记住的下标，否则让用户选）。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  convertDanmakuFormat,
  getDanmakuById,
  getDanmakuFromCache,
  getEpisodes,
  loadDanmakuDisplayState,
  loadDanmakuSettings,
  saveDanmakuDisplayState,
  saveDanmakuSettings,
  searchAnime,
} from '@/lib/danmaku/api';
import { setCachedDanmakuEpisodes } from '@/lib/danmaku/episodes-cache';
import {
  getDanmakuAnimeId,
  getDanmakuSearchKeyword,
  getDanmakuSourceIndex,
  getManualDanmakuSelection,
  saveDanmakuAnimeId,
  saveDanmakuSearchKeyword,
  saveDanmakuSourceIndex,
  saveManualDanmakuSelection,
} from '@/lib/danmaku/selection-memory';
import type {
  DanmakuAnime,
  DanmakuComment,
  DanmakuSelection,
  DanmakuSettings,
} from '@/lib/danmaku/types';
import type { DanmakuFilterConfig } from '@/lib/types';

import type { Art } from '../WatchPlayer';

export interface DanmakuEpisode {
  episodeId: number;
  episodeTitle: string;
}

export interface DanmakuState {
  loading: boolean;
  count: number;
  /** 超过上限被抽样前的数量（0 表示没抽样） */
  originalCount: number;
  selection: DanmakuSelection | null;
  /** 多个候选弹幕源，等用户选 */
  matches: DanmakuAnime[];
  keyword: string;
  episodes: DanmakuEpisode[];
  /** 本集自动加载已经结束（成功或失败） */
  settled: boolean;
}

export interface DanmakuMedia {
  title: string;
  year?: string;
  episodeIndex: number;
  episodeTitles?: string[];
  episodeCount: number;
}

// ------------------------------------------------------------ 纯函数（有测试）

function normalizeTitle(title: string) {
  return title
    .replace(/\s+/g, '')
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

/** 多个弹幕源时，按“年份 + 标题完全一致 → 标题一致 → 年份一致”收窄 */
export function narrowDanmakuSources(
  animes: DanmakuAnime[],
  title: string,
  year?: string
) {
  if (animes.length <= 1) return animes;
  const wanted = normalizeTitle(title);
  const yearOf = (date?: string) => date?.match(/^(\d{4})/)?.[1] || null;
  if (year) {
    const exact = animes.filter(
      (anime) =>
        yearOf(anime.startDate) === year &&
        normalizeTitle(anime.animeTitle) === wanted
    );
    if (exact.length) return exact;
  }
  const byTitle = animes.filter(
    (anime) => normalizeTitle(anime.animeTitle) === wanted
  );
  if (byTitle.length) return byTitle;
  if (year) {
    const byYear = animes.filter((anime) => yearOf(anime.startDate) === year);
    if (byYear.length) return byYear;
  }
  return animes;
}

export function episodeNumber(title?: string): number | null {
  if (!title) return null;
  const emby = title.match(/[Ss]\d+[Ee](\d+)/);
  if (emby) return parseInt(emby[1], 10);
  const match = title.match(/^(\d+)$|第?\s*(\d+)\s*[集话話]?/);
  return match ? parseInt(match[1] || match[2], 10) : null;
}

/** 先按集数标题对上，对不上就按顺序 */
export function matchDanmakuEpisode(
  index: number,
  episodes: DanmakuEpisode[],
  videoTitle?: string
) {
  if (!episodes.length) return null;
  const wanted = episodeNumber(videoTitle);
  if (wanted !== null) {
    const found = episodes.find(
      (ep) => episodeNumber(ep.episodeTitle) === wanted
    );
    if (found) return found;
  }
  return episodes[Math.min(index, episodes.length - 1)];
}

export function applyDanmakuFilter<T extends { text: string }>(
  items: T[],
  config: DanmakuFilterConfig | null
) {
  const rules = config?.rules?.filter((rule) => rule.enabled) || [];
  if (!rules.length) return items;
  const compiled = rules.map((rule) => {
    if (rule.type !== 'regex')
      return (text: string) => text.includes(rule.keyword);
    try {
      const regex = new RegExp(rule.keyword);
      return (text: string) => regex.test(text);
    } catch {
      return () => false;
    }
  });
  return items.filter((item) => !compiled.some((hit) => hit(item.text)));
}

/** 均匀抽样到上限 */
export function limitDanmaku<T>(items: T[], max: number) {
  if (max <= 0 || items.length <= max) return { items, original: 0 };
  const step = items.length / max;
  const picked: T[] = [];
  for (let i = 0; i < max; i++) picked.push(items[Math.floor(i * step)]);
  return { items: picked, original: items.length };
}

function maxCount() {
  try {
    return parseInt(localStorage.getItem('danmakuMaxCount') || '5000', 10);
  } catch {
    return 5000;
  }
}

export function danmakuAutoLoadDisabled() {
  try {
    const saved = localStorage.getItem('disableAutoLoadDanmaku');
    if (saved !== null) return saved === 'true';
  } catch {
    // 忽略
  }
  return (
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.DANMAKU_AUTO_LOAD_DEFAULT === false
  );
}

// ------------------------------------------------------------ 控制器

interface Resolved {
  anime: { animeId: number; animeTitle: string };
  episode: DanmakuEpisode;
  episodes: DanmakuEpisode[];
  keyword?: string;
}

const EMPTY: DanmakuState = {
  loading: false,
  count: 0,
  originalCount: 0,
  selection: null,
  matches: [],
  keyword: '',
  episodes: [],
  settled: false,
};

export class DanmakuController {
  state: DanmakuState = EMPTY;
  settings: DanmakuSettings = loadDanmakuSettings();
  filter: DanmakuFilterConfig | null = null;
  private art: Art = null;
  private media: DanmakuMedia | null = null;
  private listeners = new Set<(state: DanmakuState) => void>();
  private loadedFor: string | null = null;
  private loadingEpisodeId: number | null = null;
  private run = 0;

  constructor(private notice: (text: string) => void) {}

  subscribe(listener: (state: DanmakuState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Artplayer 插件：每个实例创建时调用 */
  artPlugin(factory: any) {
    const settings = this.settings;
    return factory({
      danmuku: [],
      speed: settings.speed,
      opacity: settings.opacity,
      fontSize: settings.fontSize,
      color: '#ffffff',
      mode: 0,
      margin: [settings.marginTop, settings.marginBottom],
      antiOverlap: true,
      synchronousPlayback: settings.synchronousPlayback,
      emitter: false,
      heatmap: false,
      theme: 'dark',
      visible: loadDanmakuDisplayState() !== false,
      filter: (item: { text: string }) =>
        applyDanmakuFilter([item], this.filter).length > 0,
    });
  }

  get plugin() {
    return this.art?.plugins?.artplayerPluginDanmuku || null;
  }

  /** 当前加载的弹幕（热力图用） */
  list(): Array<{ time: number }> {
    return this.plugin?.option?.danmuku || [];
  }

  attach(art: Art) {
    this.art = art;
    art.on('ready', () => {
      const stored = art.storage?.get?.('danmaku_settings');
      if (stored) this.saveSettings({ ...this.settings, ...stored });
      art.on('artplayerPluginDanmuku:config', () => this.captureSettings());
      art.on('artplayerPluginDanmuku:show', () =>
        saveDanmakuDisplayState(true)
      );
      art.on('artplayerPluginDanmuku:hide', () =>
        saveDanmakuDisplayState(false)
      );
      // 新实例：重新加载本集弹幕
      this.loadedFor = null;
      if (this.media) void this.autoLoad();
    });
    return () => {
      this.captureSettings();
      this.art = null;
    };
  }

  /** 换片 / 换集时调用 */
  setMedia(media: DanmakuMedia | null) {
    const previousTitle = this.media?.title;
    this.media = media;
    if (!media) return;
    if (media.title !== previousTitle) this.update({ ...EMPTY });
    if (this.plugin) void this.autoLoad();
  }

  setFilter(config: DanmakuFilterConfig | null) {
    this.filter = config;
  }

  dismissMatches() {
    this.update({ matches: [] });
  }

  /** 用户在弹幕面板选了某一集（手动选择会记住） */
  async select(selection: DanmakuSelection, manual = false) {
    const media = this.media;
    this.update({ selection });
    if (manual && media) {
      saveManualDanmakuSelection(
        media.title,
        media.episodeIndex,
        selection.episodeId
      );
      saveDanmakuAnimeId(media.title, selection.animeId);
      if (selection.searchKeyword)
        saveDanmakuSearchKeyword(media.title, selection.searchKeyword);
    }
    await this.loadEpisode(selection.episodeId, {
      animeId: selection.animeId,
      animeTitle: selection.animeTitle,
      episodeTitle: selection.episodeTitle,
      searchKeyword: selection.searchKeyword,
      danmakuCount: selection.danmakuCount,
      bypassCache: manual,
    });
  }

  /** 用户在候选弹幕源里选了一个 */
  async selectSource(anime: DanmakuAnime, index?: number, manual = false) {
    const media = this.media;
    this.update({ matches: [] });
    if (!media) return;
    if (index !== undefined) saveDanmakuSourceIndex(media.title, index);
    const result = await getEpisodes(anime.animeId).catch(() => null);
    if (!result?.success || !result.bangumi.episodes.length) return;
    const episode = matchDanmakuEpisode(
      media.episodeIndex,
      result.bangumi.episodes,
      media.episodeTitles?.[media.episodeIndex]
    );
    if (!episode) return;
    this.setEpisodes(result.bangumi.episodes);
    await this.select(
      {
        animeId: anime.animeId,
        episodeId: episode.episodeId,
        animeTitle: anime.animeTitle,
        episodeTitle: episode.episodeTitle,
      },
      manual
    );
  }

  async upload(comments: DanmakuComment[]) {
    const media = this.media;
    this.update({ loading: true });
    try {
      if (media?.title) {
        const { saveDanmakuToCache } = await import('@/lib/danmaku/cache');
        await saveDanmakuToCache(media.title, media.episodeIndex, comments);
      }
      const count = this.show(comments);
      this.notice(`上传成功，共 ${count} 条弹幕`);
    } catch {
      this.notice('弹幕加载失败');
    } finally {
      this.update({ loading: false });
    }
  }

  /** 弹幕设置面板改了设置 */
  saveSettings(settings: DanmakuSettings) {
    this.settings = settings;
    saveDanmakuSettings(settings);
    this.art?.storage?.set?.('danmaku_settings', settings);
    const plugin = this.plugin;
    if (plugin)
      plugin.config({
        speed: settings.speed,
        opacity: settings.opacity,
        fontSize: settings.fontSize,
        margin: [settings.marginTop, settings.marginBottom],
        synchronousPlayback: settings.synchronousPlayback,
      });
  }

  /** 过滤规则变了：重新加载本集 */
  async reload() {
    this.loadedFor = null;
    await this.autoLoad();
  }

  /** 看到 90% 时预先拉好下一集的弹幕（只写缓存） */
  async preloadNext() {
    const media = this.media;
    if (!media?.title || danmakuAutoLoadDisabled()) return;
    const next = media.episodeIndex + 1;
    if (next >= media.episodeCount) return;
    try {
      const cached = await getDanmakuFromCache(media.title, next);
      if (cached?.comments.length) return;
      const manual = getManualDanmakuSelection(media.title, next);
      if (manual) {
        await getDanmakuById(manual, media.title, next);
        return;
      }
      const resolved = await this.resolveAnime(media, next, false);
      if (!resolved || 'ask' in resolved) return;
      await getDanmakuById(
        resolved.episode.episodeId,
        media.title,
        next,
        undefined,
        {
          animeId: resolved.anime.animeId,
          animeTitle: resolved.anime.animeTitle,
          episodeTitle: resolved.episode.episodeTitle,
          searchKeyword: resolved.keyword,
        }
      );
    } catch {
      // 预加载失败无所谓
    }
  }

  // ------------------------------------------------------------ 内部

  private update(patch: Partial<DanmakuState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private setEpisodes(episodes: DanmakuEpisode[]) {
    this.update({ episodes });
    if (this.media?.title) setCachedDanmakuEpisodes(this.media.title, episodes);
  }

  private captureSettings() {
    const option = this.plugin?.option;
    if (!option) return;
    const next: DanmakuSettings = {
      ...this.settings,
      opacity: option.opacity || this.settings.opacity,
      fontSize: option.fontSize || this.settings.fontSize,
      speed: option.speed || this.settings.speed,
      marginTop: option.margin?.[0] ?? this.settings.marginTop,
      marginBottom: option.margin?.[1] ?? this.settings.marginBottom,
    };
    this.settings = next;
    saveDanmakuSettings(next);
    this.art?.storage?.set?.('danmaku_settings', next);
  }

  private clear() {
    const plugin = this.plugin;
    if (!plugin) return;
    plugin.reset();
    plugin.config({ danmuku: [] });
    plugin.load();
    this.update({ count: 0 });
    this.art?.emit('danmaku:loaded');
  }

  /** 过滤、限量后交给插件；返回显示的条数 */
  private show(comments: DanmakuComment[]) {
    const plugin = this.plugin;
    const filtered = applyDanmakuFilter(
      convertDanmakuFormat(comments),
      this.filter
    );
    const { items, original } = limitDanmaku(filtered, maxCount());
    if (plugin) {
      plugin.reset();
      plugin.config({
        danmuku: items,
        speed: this.settings.speed,
        opacity: this.settings.opacity,
        fontSize: this.settings.fontSize,
        margin: [this.settings.marginTop, this.settings.marginBottom],
        synchronousPlayback: this.settings.synchronousPlayback,
      });
      plugin.load();
      if (loadDanmakuDisplayState() === false) plugin.hide();
      else plugin.show();
      this.art?.emit('danmaku:loaded');
    }
    this.update({ count: items.length, originalCount: original });
    return items.length;
  }

  private async loadEpisode(
    episodeId: number,
    metadata: {
      animeId?: number;
      animeTitle?: string;
      episodeTitle?: string;
      searchKeyword?: string;
      danmakuCount?: number;
      bypassCache?: boolean;
    }
  ) {
    const media = this.media;
    if (!this.plugin || !media || this.loadingEpisodeId === episodeId) return;
    this.loadingEpisodeId = episodeId;
    this.update({ loading: true });
    try {
      this.clear();
      const comments = await getDanmakuById(
        episodeId,
        media.title,
        media.episodeIndex,
        { bypassCache: metadata.bypassCache === true },
        metadata
      );
      if (!comments.length) return;
      const count = this.show(comments);
      this.update({
        selection: {
          animeId: metadata.animeId || 0,
          episodeId,
          animeTitle: metadata.animeTitle || '',
          episodeTitle: metadata.episodeTitle || '',
          searchKeyword: metadata.searchKeyword,
          danmakuCount: count,
          danmakuOriginalCount: this.state.originalCount || undefined,
        },
      });
    } catch {
      this.update({ count: 0 });
    } finally {
      this.loadingEpisodeId = null;
      this.update({ loading: false });
    }
  }

  /** 找到弹幕源和对应的集；多个候选又没记住时返回 matches 让用户选 */
  private async resolveAnime(
    media: DanmakuMedia,
    index: number,
    allowAsk: boolean
  ): Promise<Resolved | { ask: DanmakuAnime[]; keyword: string } | null> {
    const episodeTitle = media.episodeTitles?.[index];
    const savedAnime = getDanmakuAnimeId(media.title);
    if (savedAnime) {
      const result = await getEpisodes(savedAnime).catch(() => null);
      if (result?.success && result.bangumi.episodes.length) {
        const episode = matchDanmakuEpisode(
          index,
          result.bangumi.episodes,
          episodeTitle
        );
        if (episode)
          return {
            anime: {
              animeId: savedAnime,
              animeTitle: result.bangumi.animeTitle,
            },
            episode,
            episodes: result.bangumi.episodes,
          };
      }
    }
    const keyword = getDanmakuSearchKeyword(media.title) || media.title;
    const search = await searchAnime(keyword);
    if (!search.success || !search.animes.length) return null;
    const animes = narrowDanmakuSources(search.animes, media.title, media.year);
    let anime = animes[0];
    if (animes.length > 1) {
      const remembered = getDanmakuSourceIndex(media.title);
      if (remembered !== null && remembered < animes.length)
        anime = animes[remembered];
      else if (allowAsk) return { ask: animes, keyword };
    }
    const result = await getEpisodes(anime.animeId);
    if (!result.success || !result.bangumi.episodes.length) return null;
    const episode = matchDanmakuEpisode(
      index,
      result.bangumi.episodes,
      episodeTitle
    );
    if (!episode) return null;
    return { anime, episode, episodes: result.bangumi.episodes, keyword };
  }

  private async autoLoad() {
    const media = this.media;
    if (!media?.title || media.episodeIndex < 0) return;
    const key = `${media.title}\u0000${media.episodeIndex}`;
    if (this.loadedFor === key || !this.plugin) return;
    this.loadedFor = key;
    const run = ++this.run;
    if (danmakuAutoLoadDisabled()) {
      this.update({ loading: false, settled: true, matches: [] });
      return;
    }
    this.clear();
    this.update({ loading: true, settled: false });
    try {
      const cached = await getDanmakuFromCache(media.title, media.episodeIndex);
      if (run !== this.run) return;
      if (cached?.comments.length) {
        const count = this.show(cached.comments);
        const meta = cached.metadata;
        if (meta)
          this.update({
            selection: {
              animeId: meta.animeId || 0,
              episodeId: meta.episodeId || 0,
              animeTitle: meta.animeTitle || '',
              episodeTitle: meta.episodeTitle || '',
              searchKeyword: meta.searchKeyword,
              danmakuCount: count,
              danmakuOriginalCount: this.state.originalCount || undefined,
            },
          });
        return;
      }
      const manual = getManualDanmakuSelection(media.title, media.episodeIndex);
      if (manual) {
        await this.loadEpisode(manual, {});
        return;
      }
      const resolved = await this.resolveAnime(media, media.episodeIndex, true);
      if (run !== this.run) return;
      if (!resolved) {
        this.notice('没找到匹配的弹幕，可以在弹幕面板里手动搜索');
        return;
      }
      if ('ask' in resolved) {
        this.update({ matches: resolved.ask, keyword: resolved.keyword });
        this.notice(`找到 ${resolved.ask.length} 个弹幕源，请选择`);
        return;
      }
      this.setEpisodes(resolved.episodes);
      await this.select({
        animeId: resolved.anime.animeId,
        episodeId: resolved.episode.episodeId,
        animeTitle: resolved.anime.animeTitle,
        episodeTitle: resolved.episode.episodeTitle,
      });
    } catch {
      this.notice('弹幕加载失败，请检查网络或稍后重试');
    } finally {
      if (run === this.run) this.update({ loading: false, settled: true });
    }
  }
}
