/*
 * 自己看：这一集有没有离线缓存。
 */

import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface LocalDownloadContext {
  enableOfflineDownload: boolean;
  hasOfflinePermission: boolean;
}

export function makeCheckLocalDownload(ctx: LocalDownloadContext) {
  const { enableOfflineDownload, hasOfflinePermission } = ctx;
  return async (
    source: string,
    videoId: string,
    episodeIndex: number
  ): Promise<boolean> => {
    if (!enableOfflineDownload || !hasOfflinePermission) {
      return false;
    }

    try {
      const response = await fetch(
        `/api/offline-download?action=check&source=${encodeURIComponent(
          source
        )}&videoId=${encodeURIComponent(videoId)}&episodeIndex=${episodeIndex}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.downloaded || false;
      }
    } catch (error) {
      console.error('检查本地下载失败:', error);
    }

    return false;
  };
}
