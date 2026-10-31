import {
  type BangumiCalendarData,
  GetBangumiCalendarData,
} from './bangumi.client';
import { getDoubanCategories } from './douban.client';
import type { TMDBItem } from './tmdb.client';
import type { DoubanItem } from './types';

export interface HomeCatalogueData {
  movies: DoubanItem[];
  tvshows: DoubanItem[];
  variety: DoubanItem[];
  bangumi: BangumiCalendarData[];
  duanju: Record<string, unknown>[];
  upcoming: TMDBItem[];
}
export type HomeCatalogueKey = keyof HomeCatalogueData;
export const HOME_CACHE_KEYS: Record<HomeCatalogueKey, string> = {
  movies: 'homepage_movies',
  tvshows: 'homepage_tvshows',
  variety: 'homepage_variety',
  bangumi: 'homepage_bangumi',
  duanju: 'homepage_duanju',
  upcoming: 'homepage_upcoming',
};
export const HOME_MODULE_KEYS: Record<string, HomeCatalogueKey> = {
  hotMovies: 'movies',
  hotTvShows: 'tvshows',
  hotVarietyShows: 'variety',
  bangumiCalendar: 'bangumi',
  hotDuanju: 'duanju',
  upcomingContent: 'upcoming',
};

/** Shared initial/manual loader; failures preserve each section's previous data. */
export async function loadHomeCatalogue(
  keys: HomeCatalogueKey[] = Object.keys(HOME_CACHE_KEYS) as HomeCatalogueKey[],
  signal?: AbortSignal
) {
  const data: Partial<HomeCatalogueData> = {};
  const failed: HomeCatalogueKey[] = [];
  const categories = {
    movies: { kind: 'movie' as const, category: '热门', type: '全部' },
    tvshows: { kind: 'tv' as const, category: 'tv', type: 'tv' },
    variety: { kind: 'tv' as const, category: 'show', type: 'show' },
  };
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      try {
        if (signal?.aborted) return;
        if (key === 'movies' || key === 'tvshows' || key === 'variety') {
          const result = await getDoubanCategories(categories[key]);
          if (result.code !== 200) throw new Error('Catalogue unavailable');
          data[key] = result.list;
        } else if (key === 'bangumi') {
          data.bangumi = await GetBangumiCalendarData();
        } else {
          const response = await fetch(
            key === 'duanju' ? '/api/duanju/recommends' : '/api/tmdb/upcoming',
            signal ? { signal } : undefined
          );
          if (!response.ok) throw new Error('Catalogue unavailable');
          const result = await response.json();
          if (result.code !== 200 || !Array.isArray(result.data))
            throw new Error('Invalid catalogue');
          // These two optional sections historically keep existing data on empty.
          if (!result.data.length) return;
          if (key === 'duanju') data.duanju = result.data;
          else
            data.upcoming = [...result.data].sort(
              (a, b) =>
                new Date(a.release_date || '9999-12-31').getTime() -
                new Date(b.release_date || '9999-12-31').getTime()
            );
        }
      } catch {
        if (!signal?.aborted) failed.push(key);
      }
    })
  );
  if (signal?.aborted)
    throw new DOMException('Refresh cancelled', 'AbortError');
  return { data, failed };
}
