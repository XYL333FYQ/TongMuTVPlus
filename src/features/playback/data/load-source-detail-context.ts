/*
 * 自己看（进入播放页取详情）：makeLoadSourceDetail 要页面传进来的状态和函数（名字和页面里的一样）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { SearchResult } from '@/lib/types';
import type { PlaybackSession } from '@/hooks/usePlaybackSession';

import type { FallbackRecommendation } from '../page/types';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface LoadSourceDetailContext {
  commitPlaybackHref: (url: URL) => void;
  currentEpisodeIndex: number;
  currentEpisodeIndexRef: MutableRefObject<number>;
  currentId: string;
  currentSource: string;
  fileName: string;
  initialEpisodeProgressTitle: string;
  initialEpisodeProgressYear: string;
  isLazyDetailSource: (source?: string) => boolean;
  needPreferRef: MutableRefObject<boolean>;
  optimizationEnabled: boolean;
  playbackSession: PlaybackSession;
  preferBestSource: (sources: SearchResult[]) => Promise<SearchResult>;
  resumeTimeRef: MutableRefObject<number | null>;
  searchParams: URLSearchParams;
  searchTitle: string;
  searchType: string;
  setAvailableSources: Dispatch<SetStateAction<SearchResult[]>>;
  setBackgroundSourcesLoading: Dispatch<SetStateAction<boolean>>;
  setCorrectedDesc: Dispatch<SetStateAction<string>>;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  setCurrentId: Dispatch<SetStateAction<string>>;
  setCurrentSource: Dispatch<SetStateAction<string>>;
  setDetail: Dispatch<SetStateAction<SearchResult | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFallbackRecommendations: Dispatch<
    SetStateAction<FallbackRecommendation[]>
  >;
  setHasCompletedSearchRequest: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadingMessage: Dispatch<SetStateAction<string>>;
  setLoadingStage: Dispatch<
    SetStateAction<'searching' | 'preferring' | 'fetching' | 'ready'>
  >;
  setNeedPrefer: Dispatch<SetStateAction<boolean>>;
  setSourceProxyMode: Dispatch<SetStateAction<boolean>>;
  setSourceSearchError: Dispatch<SetStateAction<string | null>>;
  setSourceSearchLoading: Dispatch<SetStateAction<boolean>>;
  setVideoCover: Dispatch<SetStateAction<string>>;
  setVideoDoubanId: Dispatch<SetStateAction<number>>;
  setVideoTitle: Dispatch<SetStateAction<string>>;
  setVideoYear: Dispatch<SetStateAction<string>>;
  videoTitle: string;
  videoTitleRef: MutableRefObject<string>;
  videoYearRef: MutableRefObject<string>;
}
