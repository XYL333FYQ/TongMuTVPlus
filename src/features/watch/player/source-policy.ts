/*
 * 片源规则：不同来源的播放地址怎么加载。纯函数，便于测试。
 */

import { isNetdiskSource, normalizeNetdiskSource } from '@/lib/netdisk/source';

/** 详情需要异步补全（打开后才拿到选集）的来源 */
export function isLazyDetailSource(source?: string | null) {
  if (!source) return false;
  return (
    source === 'openlist' ||
    source === 'emby' ||
    source.startsWith('emby_') ||
    source.startsWith('script:')
  );
}

/** 网盘挂载类来源：没有广告，可以交给浏览器原生 HLS 直连 */
export function isNetdiskMountSource(source?: string | null) {
  if (!source) return false;
  return (
    source === 'openlist' || source === 'xiaoya' || isNetdiskSource(source)
  );
}

/** 私人影库 / 网盘：以 CORS 模式加载，配合跨域扩展后 Anime4K 才能读帧 */
export function needsCrossOrigin(source?: string | null) {
  if (!source) return false;
  return (
    source === 'openlist' ||
    source === 'xiaoya' ||
    source === 'emby' ||
    source.startsWith('emby_') ||
    isNetdiskSource(source)
  );
}

/** 解析 emby_<key> 这类带后缀的来源，给接口用 */
export function parseSourceForApi(source: string): {
  source: string;
  embyKey?: string;
} {
  const normalized = normalizeNetdiskSource(source);
  if (normalized.startsWith('emby_'))
    return { source: 'emby', embyKey: normalized.substring(5) };
  return { source: normalized };
}

export type MediaType = 'hls' | 'file' | '';

export function isProxyM3u8Url(url: string) {
  return url.includes('/api/proxy-m3u8') || url.includes('/api/proxy/vod/m3u8');
}

export function isHlsLikeUrl(url: string, mediaType: MediaType = '') {
  if (!url || mediaType === 'file') return false;
  return /\.m3u8?($|\?)/i.test(url) || isProxyM3u8Url(url);
}

export function isM3u8LikeUrl(url?: string) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.m3u8') || lower.includes('/m3u8/');
}

/**
 * Artplayer 按扩展名判断类型；代理地址没有 .m3u8 扩展名，需要显式声明。
 * 单文件直链（mkv/mp4）一律走原生播放。
 */
export function artplayerTypeFor(url: string, mediaType: MediaType = '') {
  if (!url || mediaType === 'file') return undefined;
  if (url.split('?')[0].includes('.m3u8')) return undefined;
  return isProxyM3u8Url(url) ? 'm3u8' : undefined;
}

/**
 * 鸿蒙原生 HLS 播放地址：需要去广告时改走服务端 /api/proxy-m3u8，
 * 已经是代理地址时只切换 adblock 参数，避免重复套代理。
 */
export function nativeHlsUrl(
  url: string,
  options: { adBlock: boolean; source: string; origin: string }
) {
  if (!url) return url;
  try {
    const absolute = /^https?:\/\//i.test(url);
    const parsed = new URL(url, options.origin);
    if (parsed.pathname === '/api/proxy-m3u8') {
      if (options.adBlock) parsed.searchParams.delete('adblock');
      else parsed.searchParams.set('adblock', 'false');
      return absolute
        ? parsed.toString()
        : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (!options.adBlock) return url;
    let original = url;
    let proxySegments = false;
    if (parsed.pathname === '/api/proxy/vod/m3u8') {
      original = parsed.searchParams.get('url') || '';
      proxySegments = true;
    } else if (parsed.pathname === '/api/proxy/m3u8') {
      original = parsed.searchParams.get('url') || '';
    }
    if (!/^https?:\/\//i.test(original)) return url;
    const params = new URLSearchParams({
      url: original,
      source: options.source,
    });
    if (proxySegments) params.set('proxySegments', 'true');
    return `/api/proxy-m3u8?${params.toString()}`;
  } catch {
    return url;
  }
}

export function absoluteUrl(url: string, origin: string) {
  if (/^https?:\/\//.test(url)) return url;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
