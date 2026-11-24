import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import {
  type TMDBMovie,
  type TMDBMultiResult,
  type TMDBTVShow,
  getTMDBImageUrl,
  getTMDBMovieRecommendations,
  getTMDBTVRecommendations,
  searchTMDBMulti,
} from '@/lib/tmdb.client';

// 服务器端缓存（1天）
const searchCache = new Map<
  string,
  { data: { tmdbId: number; mediaType: 'movie' | 'tv' }; timestamp: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 1天

// 移除季度信息的辅助函数
function removeSeasonInfo(title: string): string {
  // 移除 "第一季"、"第1季"、"第一（1）季" 等格式
  return title
    .replace(/第[一二三四五六七八九十\d]+[（(]\d+[）)][季部]/g, '')
    .replace(/第[一二三四五六七八九十\d]+[季部]/g, '')
    .replace(/[（(]\d+[）)]/g, '')
    .replace(/\s+season\s+\d+/gi, '')
    .replace(/\s+S\d+/gi, '')
    .trim();
}

// 精确匹配标题
function findExactMatch(
  results: TMDBMultiResult[],
  originalTitle: string
): TMDBMultiResult | null {
  if (!results || results.length === 0) return null;

  // 如果只有一个结果，直接返回
  if (results.length === 1) return results[0];

  const cleanedTitle = removeSeasonInfo(originalTitle).toLowerCase();

  // 寻找完全匹配的结果
  for (const result of results) {
    const resultTitle = (result.title || result.name || '').toLowerCase();
    const resultOriginalTitle = (
      result.original_title ||
      result.original_name ||
      ''
    ).toLowerCase();

    if (resultTitle === cleanedTitle || resultOriginalTitle === cleanedTitle) {
      return result;
    }
  }

  // 如果没有完全匹配，返回第一个
  return results[0];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const title = searchParams.get('title');
    const cachedId = searchParams.get('cachedId'); // 浏览器缓存的ID

    if (!title && !cachedId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const config = await getConfig();
    const tmdbApiKey = config.SiteConfig.TMDBApiKey;
    const tmdbProxy = config.SiteConfig.TMDBProxy;
    const tmdbReverseProxy = config.SiteConfig.TMDBReverseProxy;

    // 没配置 TMDB 是正常的站点选择，不是服务器错误：返回空推荐，
    // 播放页不会在每次打开时都报错。
    if (!tmdbApiKey) {
      return NextResponse.json(
        { recommendations: [], disabled: true },
        { headers: { 'Cache-Control': 'private, max-age=300' } }
      );
    }

    let tmdbId: number;
    let mediaType: 'movie' | 'tv';

    // 如果有缓存的ID，直接使用
    if (cachedId) {
      const [type, id] = cachedId.split(':');
      mediaType = type as 'movie' | 'tv';
      tmdbId = parseInt(id);
    } else {
      // 否则搜索
      if (!title) throw new Error('缺少标题');
      const cleanedTitle = removeSeasonInfo(title);
      const cacheKey = `search:${cleanedTitle}`;

      // 检查服务器缓存
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        tmdbId = cached.data.tmdbId;
        mediaType = cached.data.mediaType;
      } else {
        // 搜索TMDB
        const searchResult = await searchTMDBMulti(
          tmdbApiKey,
          cleanedTitle,
          tmdbProxy,
          tmdbReverseProxy
        );

        if (searchResult.code !== 200 || !searchResult.results.length) {
          return NextResponse.json(
            { recommendations: [], tmdbId: null, mediaType: null },
            {
              status: 200,
              headers: {
                'Cache-Control': 'public, max-age=86400', // 浏览器缓存1天
              },
            }
          );
        }

        // 过滤出电影和电视剧
        const validResults = searchResult.results.filter(
          (r) => r.media_type === 'movie' || r.media_type === 'tv'
        );

        // 精确匹配
        const matched = findExactMatch(validResults, title);

        if (!matched) {
          return NextResponse.json(
            { recommendations: [], tmdbId: null, mediaType: null },
            {
              status: 200,
              headers: {
                'Cache-Control': 'public, max-age=86400',
              },
            }
          );
        }

        tmdbId = matched.id;
        // 搜索结果只取电影和剧集两类
        mediaType = matched.media_type as 'movie' | 'tv';

        // 保存到服务器缓存
        searchCache.set(cacheKey, {
          data: { tmdbId, mediaType },
          timestamp: Date.now(),
        });

        // 清理过期缓存
        Array.from(searchCache.entries()).forEach(([key, value]) => {
          if (Date.now() - value.timestamp > CACHE_TTL) {
            searchCache.delete(key);
          }
        });
      }
    }

    // 获取推荐
    const recommendationsResult =
      mediaType === 'movie'
        ? await getTMDBMovieRecommendations(
            tmdbApiKey,
            tmdbId,
            tmdbProxy,
            tmdbReverseProxy
          )
        : await getTMDBTVRecommendations(
            tmdbApiKey,
            tmdbId,
            tmdbProxy,
            tmdbReverseProxy
          );

    if (recommendationsResult.code !== 200) {
      return NextResponse.json(
        { recommendations: [], tmdbId: `${mediaType}:${tmdbId}`, mediaType },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=86400',
          },
        }
      );
    }

    // 转换为统一格式
    const recommendations = (
      recommendationsResult.results as (TMDBMovie | TMDBTVShow)[]
    )
      .filter((r) => r.poster_path) // 只保留有海报的
      .slice(0, 20) // 最多20个
      .map((r) => ({
        tmdbId: r.id,
        title: 'title' in r ? r.title : r.name,
        poster: getTMDBImageUrl(r.poster_path, 'w342'),
        rating: r.vote_average ? r.vote_average.toFixed(1) : '',
        mediaType,
      }));

    return NextResponse.json(
      {
        recommendations,
        tmdbId: `${mediaType}:${tmdbId}`, // 返回给浏览器用于缓存
        mediaType,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=86400', // 浏览器缓存1天
        },
      }
    );
  } catch (error) {
    logger.error('获取 TMDB 推荐失败:', error);
    return NextResponse.json({ error: '获取推荐失败' }, { status: 500 });
  }
}
