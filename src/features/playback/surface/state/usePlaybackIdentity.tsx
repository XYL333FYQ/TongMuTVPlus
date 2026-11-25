'use client';

/*
 * 播放页状态（二）：豆瓣信息、纠错描述、当前源和 ID、搜索参数、集数标题设置、是否优选、当前集。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { buildEpisodeProgressContentKey } from '@/lib/episode-progress';
import {
  EPISODE_TITLE_CORRECTION_EVENT,
  getEpisodeTitleCorrection,
} from '@/lib/episode-title-correction';
import { isNetdiskSource, normalizeNetdiskSource } from '@/lib/netdisk/source';
import { usePlaybackEpisode } from '@/hooks/usePlaybackEpisode';

import type { PlaybackSession0 } from './usePlaybackSession0';
import { type TmdbPlayDetails } from '../../data/load-tmdb-backdrop';

export function usePlaybackIdentity(vm: PlaybackSession0) {
  const {
    searchParams,
    detail,
    globalTitleFetchDisabled,
    titleCorrection,
    setTitleCorrection,
    videoTitle,
    videoDoubanId,
  } = vm;
  // 豆瓣评分数据
  const [doubanRating, setDoubanRating] = useState<{
    value: number;
    count: number;
    star_count: number;
  } | null>(null);
  // 豆瓣额外信息
  const [doubanCardSubtitle, setDoubanCardSubtitle] = useState<string>('');
  const [doubanAka, setDoubanAka] = useState<string[]>([]);
  const [doubanYear, setDoubanYear] = useState<string>(''); // 从 pubdate 提取的年份

  // 纠错后的描述信息（用于显示，不触发 detail 更新）
  const [correctedDesc, setCorrectedDesc] = useState<string>('');
  const [netdiskTMDBMeta, setNetdiskTMDBMeta] = useState<{
    desc?: string;
    poster?: string;
    year?: string;
    tmdbId?: number;
  } | null>(null);
  const [pendingNetdiskTMDBData, setPendingNetdiskTMDBData] =
    useState<TmdbPlayDetails | null>(null);

  // 当前源和ID - source 直接存储完整格式（如 'emby_wumei' 或 'emby'）
  const [currentSource, setCurrentSource] = useState(
    normalizeNetdiskSource(searchParams.get('source')) || ''
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');
  const [fileName] = useState(searchParams.get('fileName') || ''); // 小雅源：用户点击的文件名
  const isDirectPlay = currentSource === 'directplay';

  useEffect(() => {
    setNetdiskTMDBMeta(null);
    setPendingNetdiskTMDBData(null);
  }, [currentSource, currentId]);

  const isLazyDetailSource = (source?: string) => {
    if (!source) return false;
    return (
      source === 'openlist' ||
      source === 'emby' ||
      source.startsWith('emby_') ||
      source.startsWith('script:')
    );
  };

  /** 网盘挂载类源：openlist / xiaoya / netdisk-* 等挂载网盘，视频无广告，可用原生 HLS 直连播放 */
  const isNetdiskMountSource = (source?: string | null) => {
    if (!source) return false;
    return (
      source === 'openlist' || source === 'xiaoya' || isNetdiskSource(source)
    );
  };

  const isM3u8LikeUrl = (url?: string) => {
    if (!url) return false;
    const normalizedUrl = url.toLowerCase();
    return normalizedUrl.includes('.m3u8') || normalizedUrl.includes('/m3u8/');
  };

  const buildAbsoluteUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // 搜索所需信息
  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');
  const [initialEpisodeProgressTitle] = useState(
    searchTitle || searchParams.get('title') || ''
  );
  const [initialEpisodeProgressYear] = useState(searchParams.get('year') || '');

  // 全局开关或「本剧集被禁用」任一命中即禁用集数标题获取；
  // 矫正配置按标题（与传给 EpisodeSelector 的 videoTitle 一致）读取，随标题变化与矫正事件同步
  const episodeTitleFetchDisabled =
    globalTitleFetchDisabled || !!titleCorrection.disabled;
  useEffect(() => {
    const key = searchTitle || videoTitle;
    const sync = () => setTitleCorrection(getEpisodeTitleCorrection(key));
    sync();
    window.addEventListener(EPISODE_TITLE_CORRECTION_EVENT, sync);
    return () =>
      window.removeEventListener(EPISODE_TITLE_CORRECTION_EVENT, sync);
  }, [searchTitle, videoTitle, setTitleCorrection]);
  const episodeProgressContentKey = useMemo(
    () =>
      buildEpisodeProgressContentKey({
        doubanId: videoDoubanId || detail?.douban_id,
        tmdbId: detail?.tmdb_id,
        title: initialEpisodeProgressTitle,
        year: initialEpisodeProgressYear,
        searchType,
      }),
    [
      detail?.douban_id,
      detail?.tmdb_id,
      initialEpisodeProgressTitle,
      initialEpisodeProgressYear,
      searchType,
      videoDoubanId,
    ]
  );

  // 是否需要优选
  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true'
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);
  // 集数相关
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = usePlaybackEpisode(
    searchParams.get('episode')
  );

  return {
    doubanRating,
    setDoubanRating,
    doubanCardSubtitle,
    setDoubanCardSubtitle,
    doubanAka,
    setDoubanAka,
    doubanYear,
    setDoubanYear,
    correctedDesc,
    setCorrectedDesc,
    netdiskTMDBMeta,
    setNetdiskTMDBMeta,
    pendingNetdiskTMDBData,
    setPendingNetdiskTMDBData,
    currentSource,
    setCurrentSource,
    currentId,
    setCurrentId,
    fileName,
    isDirectPlay,
    isLazyDetailSource,
    isNetdiskMountSource,
    isM3u8LikeUrl,
    buildAbsoluteUrl,
    searchTitle,
    searchType,
    initialEpisodeProgressTitle,
    initialEpisodeProgressYear,
    episodeTitleFetchDisabled,
    episodeProgressContentKey,
    needPrefer,
    setNeedPrefer,
    needPreferRef,
    currentEpisodeIndex,
    setCurrentEpisodeIndex,
  };
}

export type PlaybackIdentity = ReturnType<typeof usePlaybackIdentity>;
