/*
 * 自己看：下载选中的集。
 */

import type { MutableRefObject } from 'react';

import { SearchResult } from '@/lib/types';

import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface DownloadEpisodeContext {
  addDownloadTask: (
    url: string,
    title: string,
    type?: 'TS' | 'MP4',
    metadata?: { source?: string; videoId?: string; episodeIndex?: number }
  ) => Promise<void>;
  artPlayerRef: MutableRefObject<Art | null>;
  currentId: string;
  currentSource: string;
  detail: SearchResult | null;
  externalPlayerAdBlock: boolean;
  videoTitle: string;
}

export function makeHandleDownloadEpisode(ctx: DownloadEpisodeContext) {
  const {
    addDownloadTask,
    artPlayerRef,
    currentId,
    currentSource,
    detail,
    externalPlayerAdBlock,
    videoTitle,
  } = ctx;
  return async (episodeIndexes: number[], offlineMode = false) => {
    if (!detail || !detail.episodes || episodeIndexes.length === 0) {
      if (artPlayerRef.current) {
        artPlayerRef.current.notice.show = '无法获取视频地址';
      }
      return;
    }
    const origin = `${window.location.protocol}//${window.location.host}`;

    let successCount = 0;
    let failCount = 0;

    // 批量处理下载
    for (const episodeIndex of episodeIndexes) {
      if (episodeIndex >= detail.episodes.length) {
        failCount++;
        continue;
      }

      const episodeUrl = detail.episodes[episodeIndex];

      // 离线下载模式：无论是否开启去广告，都走非去广告逻辑
      const proxyUrl = offlineMode
        ? episodeUrl // 离线下载不使用代理，直接使用原始URL
        : externalPlayerAdBlock
        ? `${origin}/api/proxy-m3u8?url=${encodeURIComponent(
            episodeUrl
          )}&source=${encodeURIComponent(currentSource)}`
        : episodeUrl;

      const isM3u8 =
        episodeUrl.toLowerCase().includes('.m3u8') ||
        episodeUrl.toLowerCase().includes('/m3u8/');

      if (offlineMode && isM3u8) {
        // 离线下载模式 - 调用服务器API
        try {
          const downloadTitle = `${videoTitle}_第${episodeIndex + 1}集`;
          const response = await fetch('/api/offline-download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              source: currentSource,
              videoId: currentId,
              episodeIndex,
              title: downloadTitle,
              m3u8Url: proxyUrl,
              metadata: detail
                ? {
                    videoTitle: detail.title,
                    cover: detail.poster,
                    description: detail.desc,
                    year: detail.year,
                    rating: undefined, // SearchResult 没有 rating 字段
                    totalEpisodes: detail.episodes?.length,
                  }
                : undefined,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            successCount++;
          } else {
            console.error(
              `离线下载任务创建失败 (第${episodeIndex + 1}集):`,
              data.error
            );
            failCount++;
          }
        } catch (error) {
          console.error(
            `离线下载任务创建失败 (第${episodeIndex + 1}集):`,
            error
          );
          failCount++;
        }
      } else if (isM3u8) {
        // M3U8格式 - 使用新的下载器，TS 格式
        try {
          const downloadTitle = `${videoTitle}_第${episodeIndex + 1}集`;
          await addDownloadTask(proxyUrl, downloadTitle, 'TS', {
            source: currentSource || undefined,
            videoId: currentId || undefined,
            episodeIndex,
          });
          successCount++;
        } catch (error) {
          console.error(`添加下载任务失败 (第${episodeIndex + 1}集):`, error);
          failCount++;
        }
      } else {
        // 普通视频格式 - 直接下载
        try {
          const a = document.createElement('a');
          a.href = proxyUrl;
          a.download = `${videoTitle}_第${episodeIndex + 1}集.mp4`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          successCount++;
          // 添加延迟避免浏览器阻止多个下载
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`下载失败 (第${episodeIndex + 1}集):`, error);
          failCount++;
        }
      }
    }

    // 显示结果通知
    if (artPlayerRef.current) {
      if (failCount === 0) {
        artPlayerRef.current.notice.show = offlineMode
          ? `已创建 ${successCount} 个离线下载任务！`
          : `已添加 ${successCount} 个下载任务！`;
      } else if (successCount === 0) {
        artPlayerRef.current.notice.show = '下载失败，请重试';
      } else {
        artPlayerRef.current.notice.show = `成功 ${successCount} 个，失败 ${failCount} 个`;
      }
    }
  };
}
