import type { PlayState } from '@/types/watch-room';

/** Playback identity is independent of whichever page the user is browsing. */
export function normalizePlaybackHref(value: string): string | null {
  try {
    const url = new URL(value, 'https://tongmu.invalid');
    if (url.origin !== 'https://tongmu.invalid' || url.pathname !== '/play')
      return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function playbackIdentity(href: string) {
  const params = new URL(href, 'https://tongmu.invalid').searchParams;
  return [
    params.get('source') || '',
    params.get('id') || params.get('title') || '',
    params.get('episode') || '1',
  ].join('\u0000');
}

export function playbackHrefFromState(state: PlayState): string {
  const params = new URLSearchParams({
    source: state.source,
    id: state.videoId,
    episode: String(state.episode || 1),
  });
  if (state.videoName) params.set('title', state.videoName);
  if (state.videoYear) params.set('year', state.videoYear);
  if (state.searchTitle) params.set('stitle', state.searchTitle);
  if (state.queueItemId) params.set('queueId', state.queueItemId);
  return `/play?${params}`;
}

export function queuePlaybackHref(
  href: string,
  episode = 1,
  queueItemId?: string
) {
  const normalized = normalizePlaybackHref(href);
  if (!normalized) throw new Error('无效的站内播放地址');
  const url = new URL(normalized, 'https://tongmu.invalid');
  url.searchParams.set('episode', String(episode));
  if (queueItemId) url.searchParams.set('queueId', queueItemId);
  return `${url.pathname}${url.search}`;
}

export function queueItemFromHref(href: string) {
  const params = new URL(href, 'https://tongmu.invalid').searchParams;
  const requested = Number(params.get('episode'));
  const episode =
    Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  return {
    title: params.get('title') || '待选影片',
    href: queuePlaybackHref(href, episode),
    source: params.get('source') || 'catalog-search',
    videoId: params.get('id') || params.get('title') || '',
    episode,
  };
}

export function anchoredPlaybackTime(
  state: PlayState,
  now: number,
  serverOffset = 0
) {
  const anchor = (state as PlayState & { updatedAt?: number }).updatedAt;
  if (!state.isPlaying || !anchor) return Math.max(0, state.currentTime || 0);
  const elapsed = Math.max(0, (now + serverOffset - anchor) / 1000);
  return Math.max(
    0,
    (state.currentTime || 0) + elapsed * (state.playbackRate || 1)
  );
}

export function filmPlaybackHref(film: {
  title: string;
  source?: string;
  id?: string;
  year?: string;
  searchType?: string;
  searchTitle?: string;
  prefer?: boolean;
  duanju?: boolean;
  episode?: number;
}) {
  const params = new URLSearchParams();
  if (film.source && film.id) {
    params.set('source', film.source);
    params.set('id', film.id);
  }
  params.set('title', film.title.trim());
  if (film.year) params.set('year', film.year);
  if (film.searchType) params.set('stype', film.searchType);
  if (film.searchTitle) params.set('stitle', film.searchTitle.trim());
  if (film.prefer) params.set('prefer', 'true');
  if (film.duanju) params.set('duanju', '1');
  if (film.episode && Number.isSafeInteger(film.episode))
    params.set('episode', String(film.episode));
  return `/play?${params}`;
}

export function roomSelectionHref(href: string) {
  const film = normalizePlaybackHref(href);
  return film ? `/watch-room?${new URLSearchParams({ film })}` : '/watch-room';
}
