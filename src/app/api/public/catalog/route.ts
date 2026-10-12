import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { fetchDoubanData } from '@/lib/douban';
import {
  type PublicCatalogItem,
  projectPublicCatalogItem,
} from '@/lib/public-catalog';
import { searchTMDBMulti } from '@/lib/tmdb.client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('mode') || (params.has('q') ? 'search' : 'browse');
  const query = (params.get('q') || '').trim();
  const type = params.get('type') || 'all';
  const limit = Number(params.get('limit') || 20);
  const start = Number(params.get('start') || 0);
  const tag = params.get('tag') || '热门';
  if (
    !['search', 'browse'].includes(mode) ||
    !['all', 'movie', 'tv'].includes(type) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 40 ||
    !Number.isInteger(start) ||
    start < 0 ||
    start > 500 ||
    query.length > 100 ||
    tag.length > 32 ||
    (mode === 'search' && !query)
  ) {
    return NextResponse.json(
      { error: '无效的元数据查询参数' },
      { status: 400 }
    );
  }
  try {
    let provider: PublicCatalogItem['provider'] = 'douban';
    let raw: Record<string, unknown>[];
    if (mode === 'search') {
      const config = await getConfig();
      if (config.SiteConfig.TMDBApiKey) {
        provider = 'tmdb';
        const result = await searchTMDBMulti(
          config.SiteConfig.TMDBApiKey,
          query,
          config.SiteConfig.TMDBProxy,
          config.SiteConfig.TMDBReverseProxy
        );
        if (result.code !== 200)
          throw new Error('metadata upstream unavailable');
        raw = result.results.filter(
          (item) => item.media_type === 'movie' || item.media_type === 'tv'
        );
      } else {
        raw = await fetchDoubanData<Record<string, unknown>[]>(
          `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(
            query
          )}`
        );
      }
    } else {
      const mediaType = type === 'tv' ? 'tv' : 'movie';
      const target = new URL('https://movie.douban.com/j/search_subjects');
      target.search = new URLSearchParams({
        type: mediaType,
        tag,
        sort: 'recommend',
        page_limit: String(limit),
        page_start: String(start),
      }).toString();
      const result = await fetchDoubanData<{
        subjects?: Record<string, unknown>[];
      }>(target.toString());
      raw = Array.isArray(result.subjects) ? result.subjects : [];
    }
    const items = (Array.isArray(raw) ? raw : [])
      .map((item) =>
        projectPublicCatalogItem(item, provider, type === 'tv' ? 'tv' : 'movie')
      )
      .filter((item): item is PublicCatalogItem => item !== null)
      .filter((item) => type === 'all' || item.mediaType === type)
      .slice(0, limit);
    return NextResponse.json(
      { items, start, hasMore: mode === 'browse' && items.length === limit },
      {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      }
    );
  } catch {
    // Do not return upstream errors: their URL can contain an API key or proxy credentials.
    return NextResponse.json(
      { error: '影视信息暂时无法获取，请稍后重试' },
      { status: 502 }
    );
  }
}
