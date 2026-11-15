/** 只接受站内 /play 地址 */
function normalizePlaybackHref(value: string): string | null {
  try {
    const url = new URL(value, 'https://tongmu.invalid');
    if (url.origin !== 'https://tongmu.invalid' || url.pathname !== '/play')
      return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
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

export function togetherSelectionHref(href: string) {
  const film = normalizePlaybackHref(href);
  return film ? `/watch-room?${new URLSearchParams({ film })}` : '/watch-room';
}

/** 片单 / 继续看用：同一部影片指定集数 */
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
