/*
 * 自己看（进入播放页取详情）：按片名搜全部片源（先用会话里的缓存，完整缓存就不再请求），只留下当前这部片的结果。
 */

import { apiFetch } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import { appendSpecialSourceParam } from '@/lib/special-source.client';
import { SearchResult } from '@/lib/types';

import type { LoadSourceDetailContext } from './load-source-detail-context';
import {
  buildFallbackRecommendations,
  filterSourcesForVideo,
  readSearchCache,
  writeCompleteSearchCache,
} from './source-search';
import { applyCorrectionsToSources } from '../lib/xiaoya-correction';

export function makeSourceResults(ctx: LoadSourceDetailContext) {
  const {
    searchType,
    setAvailableSources,
    setFallbackRecommendations,
    setHasCompletedSearchRequest,
    setSourceSearchError,
    setSourceSearchLoading,
    videoTitleRef,
    videoYearRef,
  } = ctx;
  const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
    // 根据搜索词获取全部源信息
    setHasCompletedSearchRequest(false);
    setFallbackRecommendations([]);

    let fallbackCachedResults: SearchResult[] = [];

    try {
      const cachedPayload = readSearchCache(query);
      if (cachedPayload) {
        logger.info(
          `[Play] 使用 sessionStorage ${
            cachedPayload.status === 'partial' ? '临时' : '完整'
          }缓存的搜索结果`
        );
        setFallbackRecommendations(
          buildFallbackRecommendations(cachedPayload.results, query, searchType)
        );

        const cachedResults = filterSourcesForVideo(
          cachedPayload.results,
          videoTitleRef.current,
          videoYearRef.current,
          searchType
        );
        fallbackCachedResults = cachedResults;
        setAvailableSources(applyCorrectionsToSources(cachedResults));

        if (cachedPayload.status === 'complete') {
          setHasCompletedSearchRequest(true);
          return cachedResults;
        }
      }

      // 没有缓存或只有 partial 缓存时，重新请求完整搜索结果
      const response = await apiFetch(
        appendSpecialSourceParam(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        )
      );
      if (!response.ok) {
        throw new Error('搜索失败');
      }
      const data = await response.json();
      const allResults = (data.results || []) as SearchResult[];

      writeCompleteSearchCache(query, allResults);
      setHasCompletedSearchRequest(true);
      setFallbackRecommendations(
        buildFallbackRecommendations(allResults, query, searchType)
      );

      const results = filterSourcesForVideo(
        allResults,
        videoTitleRef.current,
        videoYearRef.current,
        searchType
      );
      setAvailableSources(applyCorrectionsToSources(results));
      return results;
    } catch (err) {
      setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
      if (fallbackCachedResults.length > 0) {
        return fallbackCachedResults;
      }
      setAvailableSources([]);
      return [];
    } finally {
      setSourceSearchLoading(false);
    }
  };

  const getCachedSourcesData = (query: string): SearchResult[] => {
    const cachedPayload = readSearchCache(query);
    if (!cachedPayload) {
      return [];
    }

    return applyCorrectionsToSources(
      filterSourcesForVideo(
        cachedPayload.results,
        videoTitleRef.current,
        videoYearRef.current,
        searchType
      )
    );
  };

  return { fetchSourcesData, getCachedSourcesData };
}
