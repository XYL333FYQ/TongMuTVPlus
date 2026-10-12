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
  return `/play?${params}`;
}

export function queuePlaybackHref(href: string, episode = 1) {
  const normalized = normalizePlaybackHref(href);
  if (!normalized) throw new Error('无效的站内播放地址');
  const url = new URL(normalized, 'https://tongmu.invalid');
  url.searchParams.set('episode', String(episode));
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
