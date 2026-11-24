/*
 * 自己看：解析这一集的真实播放地址（小雅 / OpenList / 网盘懒加载、本机下载、离线缓存、代理）。
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { apiFetch } from '@/lib/api-client';
import { getIndexedDBVideoPlaybackUrl } from '@/lib/indexeddb-video-cache';
import { logger } from '@/lib/logger';
import { SearchResult } from '@/lib/types';

import type { Art } from '@/features/player';
import { LinkRefresher } from '@/features/player';

import { localPlaylistFromDirectory } from './local-playlist';
import type { PlaybackSourceBadge } from '../page/types';

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface UpdateVideoUrlContext {
  artPlayerRef: MutableRefObject<Art | null>;
  checkFileSystemDownload: (
    title: string,
    source?: string,
    videoId?: string,
    episodeIndex?: number
  ) => Promise<{ hasLocal: boolean; dirHandle?: FileSystemDirectoryHandle }>;
  checkLocalDownload: (
    source: string,
    videoId: string,
    episodeIndex: number
  ) => Promise<boolean>;
  cleanupLocalPlaybackBlobUrls: () => void;
  currentId: string;
  currentSource: string;
  detailRef: MutableRefObject<SearchResult | null>;
  isDirectplayDomainProxied: (url: string) => boolean;
  isLazyDetailSource: (source?: string) => boolean;
  lastVideoRequestKeyRef: MutableRefObject<string | null>;
  linkRefresher: LinkRefresher;
  setCorsFailedUrl: Dispatch<SetStateAction<string | null>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setPlaybackSourceBadge: Dispatch<SetStateAction<PlaybackSourceBadge>>;
  setVideoError: Dispatch<SetStateAction<string | null>>;
  setVideoLoadingStage: Dispatch<
    SetStateAction<'initing' | 'sourceChanging' | 'episodeChanging'>
  >;
  setVideoQualities: Dispatch<SetStateAction<{ name: string; url: string }[]>>;
  setVideoUrl: Dispatch<SetStateAction<string>>;
  sourceProxyMode: boolean;
  videoMediaTypeRef: MutableRefObject<'' | 'hls' | 'file'>;
  videoUrl: string;
  videoUrlRequestSeqRef: MutableRefObject<number>;
}

export function makeUpdateVideoUrl(ctx: UpdateVideoUrlContext) {
  const {
    artPlayerRef,
    checkFileSystemDownload,
    checkLocalDownload,
    cleanupLocalPlaybackBlobUrls,
    currentId,
    currentSource,
    detailRef,
    isDirectplayDomainProxied,
    isLazyDetailSource,
    lastVideoRequestKeyRef,
    linkRefresher,
    setCorsFailedUrl,
    setIsVideoLoading,
    setPlaybackSourceBadge,
    setVideoError,
    setVideoLoadingStage,
    setVideoQualities,
    setVideoUrl,
    sourceProxyMode,
    videoMediaTypeRef,
    videoUrl,
    videoUrlRequestSeqRef,
  } = ctx;
  return async (detailData: SearchResult | null, episodeIndex: number) => {
    // 换地址：停掉上一个链接的续期
    linkRefresher.clear();

    // 动态设置 referrer policy：不发送 Referer
    const existingMeta = document.querySelector('meta[name="referrer"]');
    if (!existingMeta) {
      const meta = document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'no-referrer';
      document.head.appendChild(meta);
    }

    if (
      !detailData ||
      !detailData.episodes ||
      episodeIndex >= detailData.episodes.length
    ) {
      // 这类源统一先走详情懒加载，如果 episodes 为空则跳过
      if (
        isLazyDetailSource(detailData?.source) &&
        (!detailData?.episodes || detailData.episodes.length === 0)
      ) {
        setPlaybackSourceBadge(null);
        return;
      }
      setPlaybackSourceBadge(null);
      setVideoUrl('');
      return;
    }

    const requestKey = `${detailData.source}|${detailData.id}|${episodeIndex}`;
    const isEpisodeSwitchRequest =
      lastVideoRequestKeyRef.current !== requestKey;
    lastVideoRequestKeyRef.current = requestKey;
    const requestSeq = ++videoUrlRequestSeqRef.current;
    videoMediaTypeRef.current = '';

    let newUrl = detailData?.episodes[episodeIndex] || '';
    let nextPlaybackSourceBadge: PlaybackSourceBadge = null;
    const isXiaoyaLazyPlayUrl = newUrl.startsWith('/api/xiaoya/play');

    if (isEpisodeSwitchRequest && isXiaoyaLazyPlayUrl) {
      setVideoLoadingStage('episodeChanging');
      setIsVideoLoading(true);
      setVideoError(null);
      setCorsFailedUrl(null);

      if (artPlayerRef.current?.video) {
        try {
          const video = artPlayerRef.current.video as HTMLVideoElement;
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (error) {
          logger.warn('切集时清空旧视频源失败:', error);
        }
      }

      if (videoUrl) {
        setVideoUrl('');
      }
    }

    // 如果是小雅或 openlist 接口，先请求获取真实 URL
    const isSpecialLazyPlayUrl =
      isXiaoyaLazyPlayUrl ||
      newUrl.startsWith('/api/openlist/play') ||
      newUrl.startsWith('/api/netdisk/115/play') ||
      newUrl.startsWith('/api/netdisk/123/play') ||
      newUrl.startsWith('/api/netdisk/quark/play') ||
      newUrl.startsWith('/api/netdisk/uc/play') ||
      newUrl.startsWith('/api/netdisk/baidu/play') ||
      newUrl.startsWith('/api/source-script/play');

    if (isSpecialLazyPlayUrl) {
      try {
        // 保存原始 lazy URL（用于后续刷新）
        // xiaoya：始终可刷新；openlist：先保存，再以 play 响应的 refresh14m 最终裁定
        const originalLazyUrl = newUrl;
        let refreshableUrl =
          originalLazyUrl.startsWith('/api/xiaoya/play') ||
          originalLazyUrl.startsWith('/api/openlist/play')
            ? originalLazyUrl
            : '';

        // 添加 format=json 参数
        const separator = newUrl.includes('?') ? '&' : '?';
        const fetchUrl = `${newUrl}${separator}format=json`;

        const response = await apiFetch(fetchUrl);
        const data = await response.json();
        if (requestSeq !== videoUrlRequestSeqRef.current) {
          return;
        }
        if (data.url) {
          newUrl = data.url;
          // 记录服务端探测出的媒体类型（openlist: hls/file），供单文件直连分流
          if (originalLazyUrl.startsWith('/api/openlist/play')) {
            videoMediaTypeRef.current =
              data.mediaType === 'hls' || data.mediaType === 'file'
                ? data.mediaType
                : '';
          }
          // play 响应可带回 refresh14m，覆盖 detail（配置热更新后仍一致）
          if (originalLazyUrl.startsWith('/api/openlist/play')) {
            const refresh14m =
              typeof data.refresh14m === 'boolean'
                ? data.refresh14m
                : Boolean(detailData?.refresh14m);
            if (detailData) {
              detailData.refresh14m = refresh14m;
            }
            if (detailRef.current?.source === 'openlist') {
              detailRef.current.refresh14m = refresh14m;
            }
            // 未开启续期时清空，避免误启定时器
            refreshableUrl = refresh14m ? originalLazyUrl : '';
          }
          // 保存清晰度列表
          if (data.qualities && data.qualities.length > 0) {
            setVideoQualities(data.qualities);
          } else {
            setVideoQualities([]);
          }

          // 拿到真实播放地址后立刻启动 14 分钟续期
          // xiaoya：仅 m3u8；openlist：refresh14m 即可（签名链常无扩展名）
          linkRefresher.setLink(refreshableUrl, true, newUrl);
          linkRefresher.start();
        }
      } catch (error) {
        if (requestSeq !== videoUrlRequestSeqRef.current) {
          return;
        }
        logger.error('获取播放链接失败:', error);
        setVideoQualities([]);
      }
    } else {
      // 非小雅/openlist 源，清空清晰度列表
      setVideoQualities([]);
    }

    // 检查是否有 File System API 本地下载的文件
    const episodeTitle =
      detailData?.episodes_titles?.[episodeIndex] || `第${episodeIndex + 1}集`;
    const fileSystemCheck = await checkFileSystemDownload(
      episodeTitle,
      currentSource || undefined,
      currentId || undefined,
      episodeIndex
    );
    if (requestSeq !== videoUrlRequestSeqRef.current) {
      return;
    }

    if (fileSystemCheck.hasLocal && fileSystemCheck.dirHandle) {
      // 使用本地文件播放
      try {
        cleanupLocalPlaybackBlobUrls();
        const local = await localPlaylistFromDirectory(
          fileSystemCheck.dirHandle
        );
        newUrl = local.url;
        nextPlaybackSourceBadge = 'local';

        // 保存 Blob URLs 到 window，以便在切换视频时清理
        window.__localFileBlobUrls = local.blobUrls;

        logger.info(
          '使用 File System API 本地文件播放（Blob URL 模式）:',
          episodeTitle
        );
      } catch (error) {
        logger.error('读取本地文件失败:', error);
      }
    }

    let indexedDBCheck: Awaited<
      ReturnType<typeof getIndexedDBVideoPlaybackUrl>
    > = { hasLocal: false };

    // 如果没有 File System API 本地文件，检查 IndexedDB 应用内离线缓存
    if (!fileSystemCheck.hasLocal && currentSource && currentId) {
      indexedDBCheck = await getIndexedDBVideoPlaybackUrl(
        currentSource,
        currentId,
        episodeIndex,
        { preferServiceWorker: true }
      );
      if (requestSeq !== videoUrlRequestSeqRef.current) {
        indexedDBCheck.objectUrls?.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      if (indexedDBCheck.hasLocal && indexedDBCheck.url) {
        cleanupLocalPlaybackBlobUrls();
        if (indexedDBCheck.objectUrls?.length) {
          window.__localFileBlobUrls = indexedDBCheck.objectUrls;
        }
        newUrl = indexedDBCheck.url;
        nextPlaybackSourceBadge = 'local';
        logger.info(
          `使用 IndexedDB 本地缓存播放（${
            indexedDBCheck.mode === 'service-worker'
              ? 'Service Worker'
              : 'Blob 降级'
          } 模式）:`,
          episodeTitle
        );
      }
    }

    // 如果没有 File System API / IndexedDB 本地文件，检查服务器端本地下载
    if (!fileSystemCheck.hasLocal && !indexedDBCheck.hasLocal) {
      const hasLocalFile = await checkLocalDownload(
        currentSource,
        currentId,
        episodeIndex
      );
      if (requestSeq !== videoUrlRequestSeqRef.current) {
        return;
      }

      if (hasLocalFile) {
        // 使用本地代理接口,URL以.m3u8结尾以便Artplayer自动识别
        newUrl = `/api/offline-download/local/${currentSource}/${currentId}/${episodeIndex}/playlist.m3u8`;
        nextPlaybackSourceBadge = 'offline';
        logger.info('使用服务器端本地下载文件播放:', newUrl);
      } else {
        const isM3u8 =
          newUrl.toLowerCase().includes('.m3u') ||
          !newUrl.toLowerCase().match(/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/);

        if (sourceProxyMode && newUrl && isM3u8) {
          // 如果视频源启用了代理模式,且不是本地下载,则通过代理播放
          newUrl = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
            newUrl
          )}&source=${encodeURIComponent(currentSource)}`;
          logger.info('使用代理模式播放:', newUrl);
        } else if (currentSource === 'directplay' && newUrl && isM3u8) {
          // 直链播放模式：检查 localStorage 是否记录了该域名需要代理
          if (isDirectplayDomainProxied(newUrl)) {
            newUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
              newUrl
            )}&source=directplay`;
            logger.info('直链播放（域名已记忆）使用代理模式:', newUrl);
          } else {
            logger.info('直链播放默认直连模式，不使用代理:', newUrl);
          }
        } else if (!isM3u8) {
          logger.info('非 m3u8 格式，豁免代理框架，直接播放原始URL:', newUrl);
        }
      }
    }

    if (isEpisodeSwitchRequest || newUrl !== videoUrl) {
      if (requestSeq !== videoUrlRequestSeqRef.current) {
        return;
      }
      setVideoUrl(newUrl);
    }
    setPlaybackSourceBadge(nextPlaybackSourceBadge);
  };
}
