/*
 * 把选集地址变成真正能播的地址：
 * 1. 懒加载地址（小雅 / OpenList / 网盘 / 脚本源）先换成直链，记下清晰度和是否需要定时刷新；
 * 2. 本机下载过（文件夹或浏览器缓存）就播本地；服务器离线下载过就播服务器副本；
 * 3. 片源开了代理模式、或直链域名被设为走代理时，套上代理。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getIndexedDBVideoPlaybackUrl } from '@/lib/indexeddb-video-cache';
import type { SearchResult } from '@/lib/types';

import type { MediaType } from '../player/core/source-policy';

export type PlaybackBadge = 'local' | 'offline' | null;

export interface ResolvedPlayback {
  url: string;
  mediaType: MediaType;
  qualities: Array<{ name: string; url: string }>;
  /** 需要定时刷新的懒加载地址（小雅 / OpenList） */
  lazyUrl: string;
  openlistRefresh: boolean;
  badge: PlaybackBadge;
}

const LAZY_PREFIXES = [
  '/api/xiaoya/play',
  '/api/openlist/play',
  '/api/netdisk/115/play',
  '/api/netdisk/123/play',
  '/api/netdisk/quark/play',
  '/api/netdisk/uc/play',
  '/api/netdisk/baidu/play',
  '/api/source-script/play',
];

export const isLazyPlayUrl = (url: string) =>
  LAZY_PREFIXES.some((prefix) => url.startsWith(prefix));

// ------------------------------------------------------------ 直链代理域名

const DIRECT_PROXY_KEY = 'directplay_proxy_domains';

function proxyDomains(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DIRECT_PROXY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function directplayProxied(url: string) {
  try {
    return proxyDomains().includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** 直链跨域失败后，用户选择“以后这个域名走代理” */
export function addDirectplayProxyDomain(url: string) {
  try {
    const domain = new URL(url).hostname;
    const domains = proxyDomains();
    if (!domains.includes(domain)) {
      domains.push(domain);
      localStorage.setItem(DIRECT_PROXY_KEY, JSON.stringify(domains));
    }
  } catch {
    // 忽略
  }
}

// ------------------------------------------------------------ 本地文件

let localBlobUrls: string[] = [];

export function releaseLocalBlobs() {
  localBlobUrls.forEach(
    (url) => url.startsWith('blob:') && URL.revokeObjectURL(url)
  );
  localBlobUrls = [];
}

/** 用户选过下载目录（File System Access API）里的这一集 */
async function localFolderEpisode(
  source: string,
  videoId: string,
  episodeIndex: number
) {
  if (typeof indexedDB === 'undefined') return null;
  const root = await new Promise<FileSystemDirectoryHandle | null>(
    (resolve) => {
      const request = indexedDB.open('MoonTVPlus', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('dirHandles'))
          db.createObjectStore('dirHandles');
        if (!db.objectStoreNames.contains('activeTasks')) {
          const store = db.createObjectStore('activeTasks', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('completedTasks')) {
          const store = db.createObjectStore('completedTasks', {
            keyPath: 'id',
          });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('videoId', 'videoId', { unique: false });
          store.createIndex('completedAt', 'completedAt', { unique: false });
          store.createIndex('sourceVideoId', ['source', 'videoId'], {
            unique: false,
          });
        }
      };
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('dirHandles')) {
          db.close();
          return resolve(null);
        }
        const get = db
          .transaction(['dirHandles'], 'readonly')
          .objectStore('dirHandles')
          .get('downloadDir');
        get.onsuccess = () =>
          resolve((get.result as FileSystemDirectoryHandle) || null);
        get.onerror = () => resolve(null);
      };
    }
  );
  if (!root) return null;
  try {
    const handle = root as any;
    if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
      if ((await handle.requestPermission({ mode: 'read' })) !== 'granted')
        return null;
    }
    const episode = await (
      await (await root.getDirectoryHandle(source)).getDirectoryHandle(videoId)
    ).getDirectoryHandle(`ep${episodeIndex + 1}`);
    await episode.getFileHandle('playlist.m3u8');
    return episode;
  } catch {
    return null;
  }
}

/** 把本地 playlist 里的分片 / 密钥换成 blob 地址 */
async function localPlaylistUrl(folder: FileSystemDirectoryHandle) {
  const text = await (
    await (await folder.getFileHandle('playlist.m3u8')).getFile()
  ).text();
  const blobs: string[] = [];
  const lines = await Promise.all(
    text.split('\n').map(async (line) => {
      const name = line.trim();
      const file = name.endsWith('.ts')
        ? name
        : name.includes('key.key')
        ? 'key.key'
        : '';
      if (!file) return line;
      try {
        const url = URL.createObjectURL(
          await (await folder.getFileHandle(file)).getFile()
        );
        blobs.push(url);
        return line.replace(file, url);
      } catch {
        return line;
      }
    })
  );
  const playlist = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'application/vnd.apple.mpegurl' })
  );
  blobs.push(playlist);
  return { url: playlist, blobs };
}

export function offlineDownloadAllowed() {
  if (typeof window === 'undefined') return false;
  return !!(window as any).RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD;
}

async function serverHasOffline(
  source: string,
  videoId: string,
  episodeIndex: number
) {
  try {
    const response = await fetch(
      `/api/offline-download?action=check&source=${encodeURIComponent(
        source
      )}&videoId=${encodeURIComponent(videoId)}&episodeIndex=${episodeIndex}`
    );
    if (!response.ok) return false;
    return !!(await response.json()).downloaded;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------ 解析

const looksLikeM3u8 = (url: string) =>
  url.toLowerCase().includes('.m3u') ||
  !/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/i.test(url);

export async function resolvePlayback(
  detail: SearchResult,
  episodeIndex: number,
  options: { canUseServerOffline: boolean; stale: () => boolean }
): Promise<ResolvedPlayback | null> {
  const raw = detail.episodes?.[episodeIndex];
  if (!raw) return null;
  const result: ResolvedPlayback = {
    url: raw,
    mediaType: '',
    qualities: [],
    lazyUrl: '',
    openlistRefresh: false,
    badge: null,
  };

  if (isLazyPlayUrl(raw)) {
    try {
      const separator = raw.includes('?') ? '&' : '?';
      const data = await (await fetch(`${raw}${separator}format=json`)).json();
      if (options.stale()) return null;
      if (data.url) {
        result.url = data.url;
        result.qualities = data.qualities?.length ? data.qualities : [];
        if (raw.startsWith('/api/openlist/play')) {
          result.mediaType =
            data.mediaType === 'hls' || data.mediaType === 'file'
              ? data.mediaType
              : '';
          result.openlistRefresh =
            typeof data.refresh14m === 'boolean'
              ? data.refresh14m
              : Boolean(detail.refresh14m);
          detail.refresh14m = result.openlistRefresh;
          if (result.openlistRefresh) result.lazyUrl = raw;
        } else if (raw.startsWith('/api/xiaoya/play')) result.lazyUrl = raw;
      }
    } catch {
      if (options.stale()) return null;
    }
  }

  const folder = await localFolderEpisode(
    detail.source,
    detail.id,
    episodeIndex
  );
  if (options.stale()) return null;
  if (folder) {
    try {
      releaseLocalBlobs();
      const local = await localPlaylistUrl(folder);
      localBlobUrls = local.blobs;
      return {
        ...result,
        url: local.url,
        badge: 'local',
        mediaType: 'hls',
        lazyUrl: '',
      };
    } catch {
      // 读不了就用网络
    }
  }

  const cached = await getIndexedDBVideoPlaybackUrl(
    detail.source,
    detail.id,
    episodeIndex,
    {
      preferServiceWorker: true,
    }
  );
  if (options.stale()) {
    cached.objectUrls?.forEach((url) => URL.revokeObjectURL(url));
    return null;
  }
  if (cached.hasLocal && cached.url) {
    releaseLocalBlobs();
    localBlobUrls = cached.objectUrls || [];
    return { ...result, url: cached.url, badge: 'local', lazyUrl: '' };
  }

  if (
    options.canUseServerOffline &&
    (await serverHasOffline(detail.source, detail.id, episodeIndex))
  ) {
    if (options.stale()) return null;
    return {
      ...result,
      url: `/api/offline-download/local/${detail.source}/${detail.id}/${episodeIndex}/playlist.m3u8`,
      badge: 'offline',
      lazyUrl: '',
    };
  }

  if (result.url && looksLikeM3u8(result.url) && result.mediaType !== 'file') {
    if (detail.proxyMode)
      result.url = `/api/proxy/vod/m3u8?url=${encodeURIComponent(
        result.url
      )}&source=${encodeURIComponent(detail.source)}`;
    else if (detail.source === 'directplay' && directplayProxied(result.url))
      result.url = `/api/proxy-m3u8?url=${encodeURIComponent(
        result.url
      )}&source=directplay`;
  }
  return result;
}

/** 外部播放器 / 复制链接用的地址：代理模式下用原始地址，开了去广告就走去广告代理 */
export function externalUrl(options: {
  playing: string;
  detail: SearchResult | null;
  episodeIndex: number;
  adBlock: boolean;
}) {
  let url = options.playing;
  if (
    options.detail?.proxyMode &&
    options.detail.episodes?.[options.episodeIndex]
  )
    url = options.detail.episodes[options.episodeIndex];
  if (!url) return '';
  if (options.adBlock)
    url = `${window.location.origin}/api/proxy-m3u8?url=${encodeURIComponent(
      url
    )}&source=${encodeURIComponent(options.detail?.source || '')}`;
  if (!/^https?:\/\//.test(url))
    url = `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  return url;
}
