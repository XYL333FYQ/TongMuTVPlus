/*
 * 自己看：换源（记住进度、找对应的集、换地址）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { apiFetch } from '@/lib/api-client';
import { clearDanmakuCacheByTitle } from '@/lib/danmaku/api';
import {
  deleteSkipConfig,
  migratePlayRecord,
  savePlayRecord,
  saveSkipConfig,
} from '@/lib/db.client';
import {
  buildEpisodeProgressContentKey,
  loadLocalEpisodeProgress,
  saveLocalEpisodeProgress,
} from '@/lib/episode-progress';
import { appendSpecialSourceParam } from '@/lib/special-source.client';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';
import type { PlaybackSession } from '@/hooks/usePlaybackSession';

import type { Art } from '@/features/player';

import { applyCorrection, getXiaoyaCorrection } from '../lib/xiaoya-correction';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface ChangeSourceContext {
  artPlayerRef: MutableRefObject<Art | null>;
  availableSources: SearchResult[];
  commitPlaybackHref: (url: URL) => void;
  currentEpisodeIndexRef: MutableRefObject<number>;
  currentIdRef: MutableRefObject<string>;
  currentSourceRef: MutableRefObject<string>;
  detail: SearchResult | null;
  getSourceSwitchResumeTime: (
    episodeIndex: number,
    currentPlayTime: number
  ) => Promise<number | null>;
  initialEpisodeProgressTitle: string;
  initialEpisodeProgressYear: string;
  isLazyDetailSource: (source?: string) => boolean;
  isSourceChangingRef: MutableRefObject<boolean>;
  playbackSession: PlaybackSession;
  proxyAttemptedRef: MutableRefObject<boolean>;
  resumeTimeRef: MutableRefObject<number | null>;
  searchTitle: string;
  searchType: string;
  setCorrectedDesc: Dispatch<SetStateAction<string>>;
  setCorsFailedUrl: Dispatch<SetStateAction<string | null>>;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  setCurrentId: Dispatch<SetStateAction<string>>;
  setCurrentSource: Dispatch<SetStateAction<string>>;
  setDetail: Dispatch<SetStateAction<SearchResult | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setSourceProxyMode: Dispatch<SetStateAction<boolean>>;
  setVideoCover: Dispatch<SetStateAction<string>>;
  setVideoDoubanId: Dispatch<SetStateAction<number>>;
  setVideoError: Dispatch<SetStateAction<string | null>>;
  setVideoLoadingStage: Dispatch<
    SetStateAction<'initing' | 'sourceChanging' | 'episodeChanging'>
  >;
  setVideoTitle: Dispatch<SetStateAction<string>>;
  setVideoYear: Dispatch<SetStateAction<string>>;
  skipConfigRef: MutableRefObject<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>;
  videoTitle: string;
}

export function makeHandleSourceChange(ctx: ChangeSourceContext) {
  const {
    artPlayerRef,
    availableSources,
    commitPlaybackHref,
    currentEpisodeIndexRef,
    currentIdRef,
    currentSourceRef,
    detail,
    getSourceSwitchResumeTime,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    isLazyDetailSource,
    isSourceChangingRef,
    playbackSession,
    proxyAttemptedRef,
    resumeTimeRef,
    searchTitle,
    searchType,
    setCorrectedDesc,
    setCorsFailedUrl,
    setCurrentEpisodeIndex,
    setCurrentId,
    setCurrentSource,
    setDetail,
    setError,
    setIsVideoLoading,
    setSourceProxyMode,
    setVideoCover,
    setVideoDoubanId,
    setVideoError,
    setVideoLoadingStage,
    setVideoTitle,
    setVideoYear,
    skipConfigRef,
    videoTitle,
  } = ctx;
  return async (newSource: string, newId: string, newTitle: string) => {
    try {
      // 标记正在换源，防止 title 变化触发页面刷新
      isSourceChangingRef.current = true;

      // 显示换源加载状态
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);
      setVideoError(null);
      setCorsFailedUrl(null);
      proxyAttemptedRef.current = false;

      // 记录当前播放进度（仅在同一集数切换时恢复）
      const currentPlayTime = artPlayerRef.current?.currentTime || 0;
      console.log('换源前当前播放时间:', currentPlayTime);

      // 清除并设置下一个跳过片头片尾配置
      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deleteSkipConfig(
            currentSourceRef.current,
            currentIdRef.current
          );
          await saveSkipConfig(newSource, newId, skipConfigRef.current);
        } catch (err) {
          console.error('清除跳过片头片尾配置失败:', err);
        }
      }

      let newDetail: SearchResult | undefined = availableSources.find(
        (source) => source.source === newSource && source.id === newId
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // 这类源统一通过详情接口补全播放数据
      if (
        isLazyDetailSource(newDetail.source) &&
        (!newDetail.episodes || newDetail.episodes.length === 0)
      ) {
        try {
          const detailResponse = await apiFetch(
            appendSpecialSourceParam(
              `/api/source-detail?source=${newSource}&id=${newId}&title=${encodeURIComponent(
                newTitle
              )}`
            )
          );
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            if (!detailData) {
              throw new Error('获取的详情数据为空');
            }
            newDetail = detailData;
          } else {
            throw new Error('获取视频详情失败');
          }
        } catch (err) {
          console.error('获取视频详情失败:', err);
          setIsVideoLoading(false);
          setError('获取视频详情失败，请重试');
          return;
        }
      }

      // 再次确认 newDetail 不为空（类型守卫）
      if (!newDetail) {
        setError('视频详情数据无效');
        return;
      }

      const newEpisodeProgressContentKey = buildEpisodeProgressContentKey({
        doubanId: newDetail.douban_id,
        tmdbId: newDetail.tmdb_id,
        title: initialEpisodeProgressTitle,
        year: initialEpisodeProgressYear,
        searchType,
      });

      // 尝试跳转到当前正在播放的集数
      const previousEpisodeIndex = currentEpisodeIndexRef.current;
      const previousSource = currentSourceRef.current;
      const previousId = currentIdRef.current;
      let targetIndex = previousEpisodeIndex;

      // 如果新源的集数跟旧源的集数不一致，清除当前剧集的所有弹幕缓存
      const oldEpisodeCount = detail?.episodes?.length || 0;
      const newEpisodeCount = newDetail.episodes?.length || 0;
      if (
        oldEpisodeCount > 0 &&
        newEpisodeCount > 0 &&
        oldEpisodeCount !== newEpisodeCount
      ) {
        const titleForCache = detail?.title || videoTitle;
        console.log(
          `换源集数不一致 (${oldEpisodeCount} -> ${newEpisodeCount})，清除弹幕缓存: ${titleForCache}`
        );
        clearDanmakuCacheByTitle(titleForCache).catch((err) => {
          console.error('清除弹幕缓存失败:', err);
        });
      }

      // 如果当前集数超出新源的范围，则跳转到第一集
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      const isSameEpisodeSwitch = targetIndex === previousEpisodeIndex;
      const resumeTime = isSameEpisodeSwitch
        ? await getSourceSwitchResumeTime(previousEpisodeIndex, currentPlayTime)
        : loadLocalEpisodeProgress(newEpisodeProgressContentKey, targetIndex);
      resumeTimeRef.current = resumeTime;

      // 更新URL参数（不刷新页面）
      const newUrl = new URL(
        playbackSession.href || '/play',
        window.location.origin
      );
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      newUrl.searchParams.set('title', newDetail.title || newTitle);
      commitPlaybackHref(newUrl);

      // 如果是小雅源，检查并应用纠错信息
      let finalTitle = newDetail.title || newTitle;
      let finalCover = newDetail.poster;
      let finalDesc = '';

      if (newDetail.source === 'xiaoya') {
        const correction = getXiaoyaCorrection(newDetail.source, newDetail.id);
        if (correction) {
          console.log('换源到小雅源，发现纠错信息，正在应用...', correction);
          if (correction.title) {
            finalTitle = correction.title;
          }
          if (correction.posterPath) {
            finalCover = processImageUrl(
              getTMDBImageUrl(correction.posterPath)
            );
          }
          if (correction.overview) {
            finalDesc = correction.overview;
          }
          // 应用纠错信息到 newDetail
          newDetail = applyCorrection(newDetail, correction);
        }
      }

      setVideoTitle(finalTitle);
      setVideoYear(newDetail.year);
      setVideoCover(finalCover);
      setCorrectedDesc(finalDesc);
      setVideoDoubanId(newDetail.douban_id || 0);

      if (isSameEpisodeSwitch && resumeTime && resumeTime > 1) {
        const currentDuration = artPlayerRef.current?.duration || 0;
        saveLocalEpisodeProgress(
          newEpisodeProgressContentKey,
          targetIndex,
          resumeTime,
          currentDuration
        );

        try {
          const migratedRecord = {
            title: finalTitle,
            source_name: newDetail.source_name || '',
            year: newDetail.year || '',
            cover: finalCover || '',
            index: targetIndex + 1,
            total_episodes: newDetail.episodes?.length || 1,
            play_time: Math.floor(resumeTime),
            total_time: Math.floor(currentDuration),
            save_time: Date.now(),
            search_title: searchTitle,
          };

          if (previousSource && previousId) {
            await migratePlayRecord(
              previousSource,
              previousId,
              newSource,
              newId,
              migratedRecord
            );
          } else {
            await savePlayRecord(newSource, newId, migratedRecord);
          }
        } catch (error) {
          console.warn(
            '[Play] Failed to migrate source-switch play record:',
            error
          );
        }
      }

      // newSource 已经是完整格式
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setSourceProxyMode(newDetail.proxyMode || false); // 从 detail 数据中读取代理模式
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      // 隐藏换源加载状态
      setIsVideoLoading(false);
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };
}
