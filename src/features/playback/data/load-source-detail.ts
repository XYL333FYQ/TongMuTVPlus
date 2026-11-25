/*
 * 自己看：进入播放页时取影片详情、搜索全部片源、测速优选、恢复播放记录（useEffect 的回调）。
 */

import { apiFetch } from '@/lib/api-client';
import { generateStorageKey, getAllPlayRecords } from '@/lib/db.client';
import {
  buildEpisodeProgressContentKey,
  loadLocalEpisodeProgress,
} from '@/lib/episode-progress';
import { logger } from '@/lib/logger';
import { appendSpecialSourceParam } from '@/lib/special-source.client';
import { SearchResult } from '@/lib/types';
import { parsePlaybackEpisodeIndex } from '@/hooks/usePlaybackEpisode';

import type { LoadSourceDetailContext } from './load-source-detail-context';
import { makeSourceResults } from './source-results';
import { startDirectPlay } from './start-direct-play';
import { chooseStartEpisode } from './start-episode';
import {
  applyCorrection,
  applyCorrectionsToSources,
  getXiaoyaCorrection,
} from '../lib/xiaoya-correction';

export function makeLoadSourceDetail(ctx: LoadSourceDetailContext) {
  const {
    commitPlaybackHref,
    currentEpisodeIndex,
    currentEpisodeIndexRef,
    currentId,
    currentSource,
    fileName,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    isLazyDetailSource,
    needPreferRef,
    optimizationEnabled,
    playbackSession,
    preferBestSource,
    resumeTimeRef,
    searchParams,
    searchTitle,
    searchType,
    setAvailableSources,
    setBackgroundSourcesLoading,
    setCorrectedDesc,
    setCurrentEpisodeIndex,
    setCurrentId,
    setCurrentSource,
    setDetail,
    setError,
    setLoading,
    setLoadingMessage,
    setLoadingStage,
    setNeedPrefer,
    setSourceProxyMode,
    setSourceSearchLoading,
    setVideoCover,
    setVideoDoubanId,
    setVideoTitle,
    setVideoYear,
    videoTitle,
    videoTitleRef,
  } = ctx;
  return () => {
    const fetchSourceDetail = async (
      source: string,
      id: string,
      title: string,
      fileNameParam?: string
    ): Promise<SearchResult[]> => {
      try {
        let url = appendSpecialSourceParam(
          `/api/source-detail?source=${source}&id=${id}&title=${encodeURIComponent(
            title
          )}`
        );
        // 如果有fileName参数（小雅源），添加到URL
        if (fileNameParam) {
          url += `&fileName=${encodeURIComponent(fileNameParam)}`;
        }
        const detailResponse = await apiFetch(url);
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        const sourcesWithCorrections = applyCorrectionsToSources([detailData]);
        setAvailableSources(sourcesWithCorrections);
        return sourcesWithCorrections;
      } catch (err) {
        logger.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const { fetchSourcesData, getCachedSourcesData } = makeSourceResults(ctx);

    const initAll = async () => {
      if (currentSource === 'directplay') {
        startDirectPlay(ctx);
        return;
      }

      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId ? '正在获取视频详情...' : '正在搜索播放源...'
      );

      // 如果已经有了source和id，优先通过单个详情接口快速获取
      let detailData: SearchResult | null = null;
      let sourcesInfo: SearchResult[] = [];

      if (currentSource && currentId) {
        const cachedSources = getCachedSourcesData(searchTitle || videoTitle);
        const cachedTarget = cachedSources.find(
          (source) => source.source === currentSource && source.id === currentId
        );

        if (cachedTarget?.episodes?.length) {
          detailData = cachedTarget;
          sourcesInfo = cachedSources;
          setAvailableSources(cachedSources);
          setSourceSearchLoading(false);
        } else {
          // 先快速获取当前源的详情
          try {
            // currentSource 已经是完整格式（如 'emby_wumei'）
            // 如果是小雅源且有fileName参数，传递给API
            const currentSourceDetail = await fetchSourceDetail(
              currentSource,
              currentId,
              searchTitle || videoTitle,
              currentSource === 'xiaoya' ? fileName : undefined
            );
            if (currentSourceDetail.length > 0) {
              detailData = currentSourceDetail[0];
              sourcesInfo = currentSourceDetail;
            }
          } catch (err) {
            logger.error('获取当前源详情失败:', err);
          }
        }

        // 异步获取其他源信息，不阻塞播放
        setBackgroundSourcesLoading(true);
        fetchSourcesData(searchTitle || videoTitle)
          .then((sources) => {
            // 合并当前源和搜索到的其他源
            const allSources = [...sourcesInfo];
            sources.forEach((source) => {
              // 避免重复添加当前源
              if (
                !(source.source === currentSource && source.id === currentId)
              ) {
                allSources.push(source);
              }
            });
            setAvailableSources(applyCorrectionsToSources(allSources));
            setBackgroundSourcesLoading(false);
          })
          .catch((err) => {
            logger.error('异步获取其他源失败:', err);
            setBackgroundSourcesLoading(false);
          });
      } else {
        // 没有source和id，正常搜索流程
        sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      }

      if (!detailData && sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      if (!detailData) {
        detailData = sourcesInfo[0];
      }
      // 指定源和id且无需优选
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) => source.source === currentSource && source.id === currentId
        );
        if (target) {
          detailData = target;

          // 这类源统一通过详情接口补全播放数据
          if (
            isLazyDetailSource(detailData.source) &&
            (!detailData.episodes || detailData.episodes.length === 0)
          ) {
            logger.info('[Play] Fetching lazy detail for selected source...');
            // currentSource 已经是完整格式
            const detailSources = await fetchSourceDetail(
              currentSource,
              currentId,
              searchTitle || videoTitle
            );
            if (detailSources.length > 0) {
              detailData = detailSources[0];
            }
          }
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      // 未指定源和 id 或需要优选，且开启优选开关
      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('正在优选最佳播放源...');

        // 过滤掉 openlist、所有 emby 源和 xiaoya 源，它们不参与测速
        const sourcesToTest = sourcesInfo.filter((s) => {
          // 检查是否为 openlist
          if (s.source === 'openlist') return false;

          // 检查是否为 emby 源（包括 emby 和 emby_xxx 格式）
          if (s.source === 'emby' || s.source.startsWith('emby_')) return false;

          // 检查是否为 xiaoya 源
          if (s.source === 'xiaoya') return false;

          // 脚本源详情懒加载，不参与测速
          if (s.source.startsWith('script:')) return false;

          return true;
        });

        const excludedSources = sourcesInfo.filter(
          (s) =>
            s.source === 'openlist' ||
            s.source === 'emby' ||
            s.source.startsWith('emby_') ||
            s.source === 'xiaoya' ||
            s.source.startsWith('script:')
        );

        if (sourcesToTest.length > 0) {
          detailData = await preferBestSource(sourcesToTest);
        } else if (excludedSources.length > 0) {
          // 如果只有懒加载详情的源，直接使用第一个
          detailData = excludedSources[0];
        } else {
          detailData = sourcesInfo[0];
        }
      }

      logger.info(detailData.source, detailData.id);

      // 这类源统一通过详情接口补全播放数据
      if (
        isLazyDetailSource(detailData.source) &&
        (!detailData.episodes || detailData.episodes.length === 0)
      ) {
        logger.info('[Play] Fetching lazy detail after source selection...');
        const detailSources = await fetchSourceDetail(
          detailData.source,
          detailData.id,
          detailData.title || videoTitleRef.current
        );
        if (detailSources.length > 0) {
          detailData = detailSources[0];
        }
      }

      setNeedPrefer(false);
      // 直接使用 detailData.source（已经是完整格式）
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);

      // 如果是小雅源，检查并应用纠错信息
      if (detailData.source === 'xiaoya') {
        const correction = getXiaoyaCorrection(
          detailData.source,
          detailData.id
        );
        if (correction) {
          logger.info('发现小雅源纠错信息，正在应用...', correction);
          detailData = applyCorrection(detailData, correction);
          // 同时设置纠错后的描述
          if (correction.overview) {
            setCorrectedDesc(correction.overview);
          }
        }
      }

      // 更新所有相关状态（在应用纠错信息之后）
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setVideoDoubanId(detailData.douban_id || 0);

      setDetail(detailData);
      setSourceProxyMode(detailData.proxyMode || false); // 从 detail 数据中读取代理模式
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(
        playbackSession.href || '/play',
        window.location.origin
      );
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      // 只有当元数据不是从文件获取时，才删除fileName参数
      if (detailData.metadataSource !== 'file') {
        newUrl.searchParams.delete('fileName');
      }
      commitPlaybackHref(newUrl);

      setLoadingStage('ready');
      setLoadingMessage('准备就绪，即将开始播放...');

      // 加载播放记录
      try {
        const detailEpisodeProgressContentKey = buildEpisodeProgressContentKey({
          doubanId: detailData.douban_id,
          tmdbId: detailData.tmdb_id,
          title: initialEpisodeProgressTitle,
          year: initialEpisodeProgressYear,
          searchType,
        });
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(detailData.source, detailData.id);
        const record = allRecords[key];

        const { index: initialIndex, resumeTime } = chooseStartEpisode({
          record,
          requestedIndex: parsePlaybackEpisodeIndex(
            searchParams.get('episode')
          ),
          detailInitialIndex: detailData.initialEpisodeIndex,
          episodeCount: detailData.episodes.length,
          localProgress: (index) =>
            loadLocalEpisodeProgress(detailEpisodeProgressContentKey, index),
        });
        resumeTimeRef.current = resumeTime;

        // 更新当前选集索引
        if (initialIndex < detailData.episodes.length && initialIndex >= 0) {
          setCurrentEpisodeIndex(initialIndex);
          currentEpisodeIndexRef.current = initialIndex;
        }
      } catch (err) {
        logger.error('读取播放记录失败:', err);
      }

      // 短暂延迟让用户看到完成状态
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    };

    initAll();
  };
}
