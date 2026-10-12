export interface PublicCatalogItem {
  id: string;
  title: string;
  poster: string;
  year: string;
  description: string;
  rate: string;
  mediaType: 'movie' | 'tv';
  provider: 'tmdb' | 'douban';
}

/** Construct a fresh allowlisted DTO; never spread an upstream object or SearchResult. */
export function projectPublicCatalogItem(
  input: Record<string, unknown>,
  provider: PublicCatalogItem['provider'],
  defaultType: PublicCatalogItem['mediaType'] = 'movie'
): PublicCatalogItem | null {
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const id = typeof input.id === 'number' ? String(input.id) : text(input.id);
  const title = text(input.title) || text(input.name);
  if (!/^\d+$/.test(id) || !title) return null;
  let poster = '';
  if (provider === 'tmdb') {
    const imagePath = text(input.poster_path);
    if (/^\/[a-z\d_./-]+\.(?:jpg|jpeg|png|webp)$/i.test(imagePath)) {
      poster = `https://image.tmdb.org/t/p/w500${imagePath}`;
    }
  } else {
    const image = text(input.img) || text(input.cover) || text(input.poster);
    try {
      const url = new URL(image);
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        /(^|\.)douban(?:io)?\.com$/i.test(url.hostname) &&
        /\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)
      ) {
        poster = `${url.origin}${url.pathname}`;
      }
    } catch {
      /* optional poster */
    }
  }
  const date =
    text(input.release_date) || text(input.first_air_date) || text(input.year);
  const rate =
    typeof input.vote_average === 'number'
      ? String(input.vote_average)
      : text(input.rate);
  return {
    id,
    title,
    poster,
    year: date.match(/\d{4}/)?.[0] || '',
    description:
      text(input.overview) || text(input.sub_title) || text(input.description),
    rate,
    mediaType:
      input.media_type === 'tv' || input.type === 'tv' ? 'tv' : defaultType,
    provider,
  };
}
