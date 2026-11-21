import type { SearchResult } from '@/lib/types';

import type { ToastProps } from '@/components/feedback/Toast';

/** 选集面板的三个选项卡（手机底部面板、电脑右侧图标栏共用） */
export type PlaybackPanel = 'episodes' | 'sources' | 'danmaku';

/** 手机 / 平板底部操作坞打开的半屏面板 */
export type PlaybackSheet = PlaybackPanel | 'tools' | null;

/** 片源测速结果：分辨率、码率等 */
export interface SourceVideoInfo {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  bitrate: string;
}

/** 片源都找不到时，失败页下方“也许你想看”的一项 */
export interface FallbackRecommendation {
  key: string;
  item: SearchResult;
  episodes?: number;
  sourceNames: string[];
  doubanId?: number;
}

export type ShowToast = (
  message: string,
  type: NonNullable<ToastProps['type']>
) => void;

/** 当前播放来自本机下载 / 离线缓存时，画面角上的标记 */
export type PlaybackSourceBadge = 'local' | 'offline' | null;

/** 片源搜索结果的会话缓存 */
export interface SearchCachePayload {
  status: 'complete' | 'partial';
  results: SearchResult[];
  query: string;
  updatedAt: number;
}
