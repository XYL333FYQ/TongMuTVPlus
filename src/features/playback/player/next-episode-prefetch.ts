/*
 * 自己看：播放中每隔几秒保存一次进度；按设置，快播完时预缓冲下一集的片子、预加载下一集的弹幕（各只做一次）。
 */

import { apiFetch } from '@/lib/api-client';
import { readSetting } from '@/lib/settings';

import type { Art } from '@/features/player';

/** 页面传进来的状态和函数（名字和页面里的一样） */
import type { WireInstanceContext } from './wire-instance';

export function watchProgressAndPrefetch(art: Art, ctx: WireInstanceContext) {
  const {
    currentEpisodeIndexRef,
    danmaku,
    detailRef,
    lastSaveTimeRef,
    nextEpisodeDanmakuPreloadTriggeredRef,
    nextEpisodePreCacheTriggeredRef,
    saveCurrentPlayProgress,
  } = ctx;
  art.on('video:timeupdate', () => {
    const now = Date.now();
    let interval = 5000;
    if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'upstash') {
      interval = 20000;
    }
    if (now - lastSaveTimeRef.current > interval) {
      saveCurrentPlayProgress();
      lastSaveTimeRef.current = now;
    }

    // 下集预缓冲逻辑
    const nextEpisodePreCacheEnabled =
      typeof window !== 'undefined'
        ? readSetting('nextEpisodePreCache') === 'true'
        : false;

    if (nextEpisodePreCacheEnabled) {
      const currentTime = art?.currentTime || 0;
      const duration = art?.duration || 0;
      const progress = duration > 0 ? currentTime / duration : 0;

      // 检查是否已经到达90%播放进度
      if (
        duration > 0 &&
        progress >= 0.9 &&
        !nextEpisodePreCacheTriggeredRef.current
      ) {
        // 标记已触发，防止重复执行
        nextEpisodePreCacheTriggeredRef.current = true;

        // 获取下一集信息
        const currentIdx = currentEpisodeIndexRef.current;
        const episodes = detailRef.current?.episodes;

        if (!episodes || currentIdx >= episodes.length - 1) {
          return;
        }

        const nextEpisodeIndex = currentIdx + 1;
        const nextEpisodeUrl = episodes[nextEpisodeIndex];

        if (!nextEpisodeUrl) {
          return;
        }

        // 使用 fetch 预加载资源，利用浏览器缓存
        const preloadNextEpisode = async () => {
          try {
            // 判断是否是m3u8流
            if (
              nextEpisodeUrl.includes('.m3u8') ||
              nextEpisodeUrl.includes('m3u8')
            ) {
              // 1. 先fetch m3u8文件
              const m3u8Response = await apiFetch(nextEpisodeUrl);
              const m3u8Text = await m3u8Response.text();

              // 2. 解析m3u8，提取ts分片URL
              const lines = m3u8Text.split('\n');
              const tsUrls: string[] = [];
              const baseUrl = nextEpisodeUrl.substring(
                0,
                nextEpisodeUrl.lastIndexOf('/') + 1
              );

              for (const line of lines) {
                const trimmedLine = line.trim();
                // 跳过注释和空行
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                  continue;
                }
                // 构建完整的ts URL
                const tsUrl = trimmedLine.startsWith('http')
                  ? trimmedLine
                  : baseUrl + trimmedLine;
                tsUrls.push(tsUrl);
              }

              // 3. 预加载前20个ts分片
              const maxFragmentsToPreload = Math.min(20, tsUrls.length);

              for (let i = 0; i < maxFragmentsToPreload; i++) {
                try {
                  await apiFetch(tsUrls[i]);
                } catch (err) {
                  // 静默处理分片加载失败
                }
              }
            }
          } catch (error) {
            // 静默处理预缓冲失败
          }
        };

        // 异步执行预缓冲
        preloadNextEpisode();
      }
    }

    // 下集弹幕预加载逻辑
    const nextEpisodeDanmakuPreloadEnabled =
      typeof window !== 'undefined'
        ? readSetting('nextEpisodeDanmakuPreload') === 'true'
        : false;

    if (nextEpisodeDanmakuPreloadEnabled) {
      const currentTime = art?.currentTime || 0;
      const duration = art?.duration || 0;
      const progress = duration > 0 ? currentTime / duration : 0;

      // 检查是否已经到达90%播放进度
      if (
        duration > 0 &&
        progress >= 0.9 &&
        !nextEpisodeDanmakuPreloadTriggeredRef.current
      ) {
        // 标记已触发，防止重复执行
        nextEpisodeDanmakuPreloadTriggeredRef.current = true;

        // 异步执行弹幕预加载
        void danmaku.preloadNext();
      }
    }
  });
}
