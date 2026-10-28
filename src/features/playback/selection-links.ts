import { normalizePlaybackHref } from './session';

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
