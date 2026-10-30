import { API_CONFIG } from '@/lib/config';
import { getDuanjuSources } from '@/lib/duanju';
import type { PublicCatalogItem } from '@/lib/public-catalog';
import { cleanHtmlTags } from '@/lib/html-text';

/** Public projection only. Never expose source keys, CMS configuration or play fields. */
export async function browsePublicDuanju(
  start: number,
  limit: number,
  cursor = '1:0'
) {
  const source = (await getDuanjuSources()).find((item) => item.typeId);
  if (!source) return { items: [], start, hasMore: false, nextStart: start };
  const [page, offset] = cursor.split(':').map(Number);
  const target = new URL(source.api);
  target.searchParams.set('ac', 'list');
  target.searchParams.set('t', source.typeId || '');
  target.searchParams.set('pg', String(page));
  const response = await fetch(target.toString(), {
    headers: API_CONFIG.search.headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('metadata upstream unavailable');
  const data = await response.json();
  const list: Record<string, unknown>[] = Array.isArray(data.list)
    ? data.list
    : [];
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const items = list
    .slice(offset, offset + limit)
    .flatMap((item, index): PublicCatalogItem[] => {
      const title = text(item.vod_name).trim();
      if (!title) return [];
      let poster = '';
      try {
        const image = new URL(text(item.vod_pic));
        if (
          image.protocol === 'https:' &&
          !image.username &&
          !image.password &&
          image.hostname !== target.hostname &&
          !/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/i.test(
            image.hostname
          ) &&
          /\.(?:jpg|jpeg|png|webp)$/i.test(image.pathname)
        )
          poster = image.origin + image.pathname;
      } catch {
        /* optional public image */
      }
      return [
        {
          id: /^\d+$/.test(String(item.vod_id))
            ? String(item.vod_id)
            : String(start + index),
          title,
          poster,
          year: text(item.vod_year).match(/\d{4}/)?.[0] || '',
          description: cleanHtmlTags(text(item.vod_content)),
          rate: text(item.vod_douban_score),
          mediaType: 'tv',
          provider: 'cms',
        },
      ];
    });
  const consumed = Math.min(offset + limit, list.length);
  const nextStart = start + items.length;
  return {
    items,
    start,
    hasMore:
      list.length > 0 &&
      (consumed < list.length || page < Number(data.pagecount || 1)),
    nextStart,
    nextCursor:
      consumed < list.length ? `${page}:${consumed}` : `${page + 1}:0`,
  };
}
