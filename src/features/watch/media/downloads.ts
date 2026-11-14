/*
 * 下载选中的集：服务器离线下载（管理员）、浏览器内 m3u8 下载、或直接下载文件。
 */

import type { SearchResult } from '@/lib/types';

type AddTask = (
  url: string,
  title: string,
  type: 'TS',
  meta: { source?: string; videoId?: string; episodeIndex: number }
) => Promise<unknown>;

export async function downloadEpisodes(options: {
  detail: SearchResult;
  indexes: number[];
  offline: boolean;
  adBlock: boolean;
  addTask: AddTask;
}) {
  const { detail, indexes, offline, adBlock, addTask } = options;
  const origin = window.location.origin;
  let ok = 0;
  let failed = 0;
  for (const index of indexes) {
    const raw = detail.episodes?.[index];
    if (!raw) {
      failed++;
      continue;
    }
    const url =
      !offline && adBlock
        ? `${origin}/api/proxy-m3u8?url=${encodeURIComponent(
            raw
          )}&source=${encodeURIComponent(detail.source)}`
        : raw;
    const isM3u8 =
      raw.toLowerCase().includes('.m3u8') ||
      raw.toLowerCase().includes('/m3u8/');
    const title = `${detail.title}_第${index + 1}集`;
    try {
      if (offline && isM3u8) {
        const response = await fetch('/api/offline-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: detail.source,
            videoId: detail.id,
            episodeIndex: index,
            title,
            m3u8Url: url,
            metadata: {
              videoTitle: detail.title,
              cover: detail.poster,
              description: detail.desc,
              year: detail.year,
              totalEpisodes: detail.episodes?.length,
            },
          }),
        });
        if (!response.ok) throw new Error('离线下载任务创建失败');
      } else if (isM3u8) {
        await addTask(url, title, 'TS', {
          source: detail.source,
          videoId: detail.id,
          episodeIndex: index,
        });
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.mp4`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      ok++;
    } catch {
      failed++;
    }
  }
  if (!failed)
    return offline ? `已创建 ${ok} 个离线下载任务` : `已添加 ${ok} 个下载任务`;
  if (!ok) return '下载失败，请重试';
  return `成功 ${ok} 个，失败 ${failed} 个`;
}
