/*
 * 弹幕匹配：标题归一、多个弹幕源时收窄、按集数对上、过滤、限量，以及“这部片这一集用哪个弹幕源”。
 * 都不依赖控制器状态，从 danmaku.ts 拆出来（DanmakuController 用它们）。
 */

import { getEpisodes, searchAnime } from '@/lib/danmaku/api';
import {
  getDanmakuAnimeId,
  getDanmakuSearchKeyword,
  getDanmakuSourceIndex,
} from '@/lib/danmaku/selection-memory';
import type { DanmakuAnime } from '@/lib/danmaku/types';
import { readSetting } from '@/lib/settings';
import type { DanmakuFilterConfig } from '@/lib/types';

import type { DanmakuEpisode, DanmakuMedia } from './danmaku';

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

export function maxCount() {
  return parseInt(readSetting('danmakuMaxCount') || '5000', 10);
}

export function danmakuAutoLoadDisabled() {
  const saved = readSetting('disableAutoLoadDanmaku');
  if (saved !== null) return saved === 'true';
  return (
    typeof window !== 'undefined' &&
    window.RUNTIME_CONFIG?.DANMAKU_AUTO_LOAD_DEFAULT === false
  );
}

export interface Resolved {
  anime: { animeId: number; animeTitle: string };
  episode: DanmakuEpisode;
  episodes: DanmakuEpisode[];
  keyword?: string;
}

/** 找到弹幕源和对应的集；多个候选又没记住时返回 matches 让用户选 */
export async function resolveDanmakuAnime(
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
