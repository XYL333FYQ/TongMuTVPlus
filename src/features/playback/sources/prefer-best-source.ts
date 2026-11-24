/*
 * 自己看：给候选片源测速打分，挑最好的一个。
 */

import type { Dispatch, SetStateAction } from 'react';

import { logger } from '@/lib/logger';
import { getVideoResolutionFromM3u8 } from '@/lib/media-engines';
import { SearchResult } from '@/lib/types';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface PreferBestSourceContext {
  calculateSourceScore: (
    testResult: { quality: string; loadSpeed: string; pingTime: number },
    maxSpeed: number,
    minPing: number,
    maxPing: number,
    weight?: number
  ) => number;
  isDirectplayDomainProxied: (url: string) => boolean;
  preferStrategy: 'fast' | 'full';
  setPrecomputedVideoInfo: Dispatch<
    SetStateAction<
      Map<
        string,
        {
          quality: string;
          loadSpeed: string;
          pingTime: number;
          bitrate: string;
        }
      >
    >
  >;
}

export function makePreferBestSource(ctx: PreferBestSourceContext) {
  const { isDirectplayDomainProxied, preferStrategy, setPrecomputedVideoInfo } =
    ctx;
  return async (sources: SearchResult[]): Promise<SearchResult> => {
    if (sources.length === 1) return sources[0];

    type SourceTestResult = {
      source: SearchResult;
      testResult: {
        quality: string;
        loadSpeed: string;
        pingTime: number;
        bitrate: string;
      };
    };
    type MaybeSourceTestResult = SourceTestResult | null;

    const sortedByWeight = [...sources].sort((a, b) => {
      const weightA = a.weight ?? 0;
      const weightB = b.weight ?? 0;
      return weightB - weightA;
    });

    const finalizeSelection = (
      completedResults: MaybeSourceTestResult[]
    ): SearchResult => {
      const newVideoInfoMap = new Map<
        string,
        {
          quality: string;
          loadSpeed: string;
          pingTime: number;
          bitrate: string;
        }
      >();
      completedResults.forEach((result) => {
        if (!result) return;
        const sourceKey = `${result.source.source}-${result.source.id}`;
        newVideoInfoMap.set(sourceKey, result.testResult);
      });
      setPrecomputedVideoInfo(newVideoInfoMap);

      const successfulResults = completedResults.filter(
        Boolean
      ) as SourceTestResult[];

      if (successfulResults.length === 0) {
        logger.warn('所有播放源测速都失败，按权重排序');
        return sortedByWeight[0];
      }

      const validSpeeds = successfulResults
        .map((result) => {
          const speedStr = result.testResult.loadSpeed;
          if (speedStr === '未知' || speedStr === '测量中...') return 0;

          const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
          if (!match) return 0;

          const value = parseFloat(match[1]);
          const unit = match[2];
          return unit === 'MB/s' ? value * 1024 : value;
        })
        .filter((speed) => speed > 0);

      const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;

      const validPings = successfulResults
        .map((result) => result.testResult.pingTime)
        .filter((ping) => ping > 0);

      const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
      const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

      const resultsWithScore = successfulResults.map((result) => ({
        ...result,
        score: ctx.calculateSourceScore(
          result.testResult,
          maxSpeed,
          minPing,
          maxPing,
          result.source.weight ?? 0
        ),
      }));

      resultsWithScore.sort((a, b) => b.score - a.score);

      logger.info('播放源评分排序结果:');
      resultsWithScore.forEach((result, index) => {
        logger.info(
          `${index + 1}. ${
            result.source.source_name
          } - 评分: ${result.score.toFixed(2)} (${result.testResult.quality}, ${
            result.testResult.loadSpeed
          }, ${result.testResult.pingTime}ms)`
        );
      });

      return resultsWithScore[0].source;
    };

    const testSingleSource = async (
      source: SearchResult
    ): Promise<MaybeSourceTestResult> => {
      try {
        if (!source.episodes || source.episodes.length === 0) {
          logger.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
          return null;
        }

        let episodeUrl =
          source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];

        const isM3u8 =
          episodeUrl.toLowerCase().includes('.m3u') ||
          !episodeUrl
            .toLowerCase()
            .match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);
        if (source.source === 'directplay' && isM3u8) {
          if (isDirectplayDomainProxied(episodeUrl)) {
            episodeUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
              episodeUrl
            )}&source=directplay`;
          }
        } else if (source.proxyMode && isM3u8) {
          episodeUrl = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
            episodeUrl
          )}&source=${encodeURIComponent(source.source)}`;
        }

        const testResult = await getVideoResolutionFromM3u8(episodeUrl);

        return {
          source,
          testResult,
        };
      } catch (error) {
        return null;
      }
    };

    const maxConcurrency = Math.ceil(sources.length / 2);

    const runAllWithSameConcurrency = async (): Promise<
      MaybeSourceTestResult[]
    > => {
      const results: MaybeSourceTestResult[] = new Array(sources.length);
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < sources.length) {
          const currentIndex = nextIndex++;
          results[currentIndex] = await testSingleSource(sources[currentIndex]);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, sources.length) }, () =>
          worker()
        )
      );

      return results;
    };

    if (preferStrategy === 'full' || sortedByWeight.length < 5) {
      const allResults = await runAllWithSameConcurrency();
      return finalizeSelection(allResults);
    }

    const topPriorityKeys = new Set(
      sortedByWeight
        .slice(0, 5)
        .map((source) => `${source.source}-${source.id}`)
    );

    const quickResults = await new Promise<MaybeSourceTestResult[]>(
      (resolve) => {
        const results: Array<MaybeSourceTestResult | undefined> = new Array(
          sources.length
        );
        let nextIndex = 0;
        let activeCount = 0;
        let completedCount = 0;
        let topCompletedCount = 0;
        let topSuccessCount = 0;
        let settled = false;

        const maybeResolve = () => {
          if (settled) return;

          if (topCompletedCount === 5 && topSuccessCount > 0) {
            settled = true;
            resolve(
              results.filter(
                (result) => result !== undefined
              ) as MaybeSourceTestResult[]
            );
            return;
          }

          if (completedCount === sources.length) {
            settled = true;
            resolve(results as MaybeSourceTestResult[]);
            return;
          }

          while (
            !settled &&
            activeCount < maxConcurrency &&
            nextIndex < sources.length
          ) {
            const currentIndex = nextIndex++;
            const currentSource = sources[currentIndex];
            const sourceKey = `${currentSource.source}-${currentSource.id}`;
            activeCount += 1;

            testSingleSource(currentSource)
              .then((result) => {
                results[currentIndex] = result;
                completedCount += 1;

                if (topPriorityKeys.has(sourceKey)) {
                  topCompletedCount += 1;
                  if (result) {
                    topSuccessCount += 1;
                  }
                }
              })
              .finally(() => {
                activeCount -= 1;
                maybeResolve();
              });
          }
        };

        maybeResolve();
      }
    );

    return finalizeSelection(quickResults);
  };
}
