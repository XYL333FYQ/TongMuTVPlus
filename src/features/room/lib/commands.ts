/*
 * 房间里“放这一部 / 换这一集 / 停止放映 / 加入片单”的命令内容。
 */

import type { SearchResult } from '@/lib/types';

import type { PlayState, RoomQueueItem } from '@/types/watch-room';

export interface FilmRef {
  source: string;
  videoId: string;
  title: string;
  year?: string;
  searchTitle?: string;
  poster?: string;
}

export function filmFromResult(item: SearchResult): FilmRef {
  return {
    source: item.source,
    videoId: item.id,
    title: item.title,
    year: item.year && item.year !== 'unknown' ? item.year : undefined,
    poster: item.poster || undefined,
  };
}

/** 站内播放地址 /play?source=&id=&title= */
export function filmHref(film: FilmRef, episode = 1) {
  const params = new URLSearchParams({
    source: film.source,
    id: film.videoId,
    title: film.title,
    episode: String(episode),
  });
  if (film.year) params.set('year', film.year);
  if (film.searchTitle) params.set('stitle', film.searchTitle);
  return `/play?${params}`;
}

export function filmFromHref(href: string): FilmRef | null {
  try {
    const params = new URL(href, 'https://tongmu.invalid').searchParams;
    const source = params.get('source');
    const videoId = params.get('id');
    if (!source || !videoId) return null;
    return {
      source,
      videoId,
      title: params.get('title') || '影片',
      year: params.get('year') || undefined,
      searchTitle: params.get('stitle') || undefined,
    };
  } catch {
    return null;
  }
}

/** play:change：从头开始播放这一部的这一集 */
export function playChange(
  film: FilmRef,
  episode = 1,
  queueItemId?: string
): Omit<PlayState, 'updatedAt' | 'version'> {
  return {
    type: 'play',
    url: '',
    source: film.source,
    videoId: film.videoId,
    videoName: film.title,
    videoYear: film.year,
    searchTitle: film.searchTitle,
    poster: film.poster,
    episode,
    currentTime: 0,
    isPlaying: true,
    playbackRate: 1,
    ...(queueItemId ? { queueItemId } : {}),
  };
}

export function filmFromState(state: PlayState): FilmRef {
  return {
    source: state.source,
    videoId: state.videoId,
    title: state.videoName,
    year: state.videoYear,
    searchTitle: state.searchTitle,
    poster: state.poster,
  };
}

export function queueAdd(film: FilmRef, episode = 1) {
  return {
    title: film.title,
    href: filmHref(film, episode),
    source: film.source,
    videoId: film.videoId,
    episode,
    ...(film.poster ? { poster: film.poster } : {}),
  };
}

export function filmFromQueue(item: RoomQueueItem): FilmRef | null {
  const fromHref = filmFromHref(item.href);
  if (!fromHref) return null;
  return {
    ...fromHref,
    title: item.title || fromHref.title,
    poster: item.poster,
  };
}
