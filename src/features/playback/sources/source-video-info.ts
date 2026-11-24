/*
 * 自己看：当前片源的分辨率、码率。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { getVideoResolutionFromM3u8 } from '@/lib/media-engines';
import { SearchResult } from '@/lib/types';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface SourceVideoInfoContext {
  currentEpisodeIndex: number;
  currentSource: string;
  detail: SearchResult | null;
  isDirectplayDomainProxied: (url: string) => boolean;
  setCurrentSourceVideoInfo: Dispatch<
    SetStateAction<{
      quality: string;
      loadSpeed: string;
      pingTime: number;
      bitrate: string;
    } | null>
  >;
  sourceProxyMode: boolean;
  videoMediaTypeRef: MutableRefObject<'' | 'hls' | 'file'>;
}

export function makeFetchCurrentSourceVideoInfo(ctx: SourceVideoInfoContext) {
  const {
    currentEpisodeIndex,
    currentSource,
    detail,
    isDirectplayDomainProxied,
    setCurrentSourceVideoInfo,
    sourceProxyMode,
    videoMediaTypeRef,
  } = ctx;
  return async () => {
    if (!detail || !detail.episodes || detail.episodes.length === 0) {
      return;
    }

    // 获取当前集数的播放地址
    let episodeUrl = detail.episodes[currentEpisodeIndex];
    if (!episodeUrl) {
      return;
    }

    // openlist 的 lazy 播放地址或已确认的单文件直链（如 mkv），解析前无法探测分辨率（内部 hls.js XHR 还会触发 CORS 误报），跳过
    if (
      episodeUrl.startsWith('/api/openlist/play') ||
      videoMediaTypeRef.current === 'file'
    ) {
      setCurrentSourceVideoInfo(null);
      return;
    }

    // 简单的正则或者后缀判断，如果明确不是 m3u8 (比如 mp4)，则不走 m3u8 代理
    const isM3u8 =
      episodeUrl.toLowerCase().includes('.m3u') ||
      !episodeUrl.toLowerCase().match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);

    if (currentSource === 'directplay' && isM3u8) {
      // 仅当 localStorage 记忆了该域名需要代理时才走代理
      if (isDirectplayDomainProxied(episodeUrl)) {
        episodeUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
          episodeUrl
        )}&source=directplay`;
      } else {
        // 直链模式且未走代理：跳过 HLS.js 探测。
        // getVideoResolutionFromM3u8 内部使用 HLS.js (XMLHttpRequest) 加载，
        // 而 XHR 受 CORS 限制，探测必然失败。实际播放器通过 <video src> 加载不受 CORS 影响。
        console.log(
          '[视频信息] 直链直连模式，跳过分辨率探测（避免 CORS 误报）'
        );
        setCurrentSourceVideoInfo(null);
        return;
      }
    } else if (sourceProxyMode && isM3u8) {
      episodeUrl = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
        episodeUrl
      )}&source=${encodeURIComponent(currentSource)}`;
    }

    try {
      const info = await getVideoResolutionFromM3u8(episodeUrl, 4000);
      setCurrentSourceVideoInfo(info);
    } catch (error) {
      console.error('获取视频信息失败:', error);
      setCurrentSourceVideoInfo(null);
    }
  };
}
