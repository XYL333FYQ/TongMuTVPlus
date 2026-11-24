/* eslint-disable @typescript-eslint/no-explicit-any */
import bs58 from 'bs58';

import { getTmdbImageBaseUrl } from './tmdb-image-base';

export type DoubanImageProxyType =
  | 'direct'
  | 'server'
  | 'img3'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'custom';

function normalizeDoubanImageProxyConfig(
  proxyType: DoubanImageProxyType,
  proxyUrl: string
): {
  proxyType: DoubanImageProxyType;
  proxyUrl: string;
} {
  const normalizedProxyUrl = proxyUrl.trim();

  if (proxyType === 'custom' && !normalizedProxyUrl) {
    return {
      proxyType: 'server',
      proxyUrl: '',
    };
  }

  return {
    proxyType,
    proxyUrl: normalizedProxyUrl,
  };
}

function buildDoubanImageUrl(
  originalUrl: string,
  proxyType: DoubanImageProxyType,
  proxyUrl: string
): string {
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return proxyUrl
        ? `${proxyUrl}${encodeURIComponent(originalUrl)}`
        : originalUrl;
    case 'direct':
    default:
      return originalUrl;
  }
}

function getDoubanImageProxyConfig(): {
  proxyType: DoubanImageProxyType;
  proxyUrl: string;
  backupProxyType: DoubanImageProxyType;
  backupProxyUrl: string;
} {
  // 确保在浏览器环境中执行
  if (typeof window === 'undefined') {
    return {
      proxyType: 'cmliussss-cdn-tencent',
      proxyUrl: '',
      backupProxyType: 'server',
      backupProxyUrl: '',
    };
  }

  const doubanImageProxyType =
    (localStorage.getItem(
      'doubanImageProxyType'
    ) as DoubanImageProxyType | null) ||
    window.RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    window.RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  const doubanImageProxyBackupType =
    (localStorage.getItem(
      'doubanImageProxyTypeBackup'
    ) as DoubanImageProxyType | null) || 'server';
  const doubanImageProxyBackupUrl =
    localStorage.getItem('doubanImageProxyUrlBackup') || '';
  const primaryConfig = normalizeDoubanImageProxyConfig(
    doubanImageProxyType,
    doubanImageProxy
  );
  const backupConfig = normalizeDoubanImageProxyConfig(
    doubanImageProxyBackupType,
    doubanImageProxyBackupUrl
  );
  return {
    proxyType: primaryConfig.proxyType,
    proxyUrl: primaryConfig.proxyUrl,
    backupProxyType: backupConfig.proxyType,
    backupProxyUrl: backupConfig.proxyUrl,
  };
}

export function getDoubanImageFallbackUrl(originalUrl: string): string | null {
  if (!originalUrl || !originalUrl.includes('doubanio.com')) {
    return null;
  }

  const { proxyType, proxyUrl, backupProxyType, backupProxyUrl } =
    getDoubanImageProxyConfig();
  const primaryUrl = buildDoubanImageUrl(originalUrl, proxyType, proxyUrl);
  const backupUrl = buildDoubanImageUrl(
    originalUrl,
    backupProxyType,
    backupProxyUrl
  );

  if (backupUrl === primaryUrl) {
    return null;
  }

  return backupUrl;
}

function isBangumiImageUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'lain.bgm.tv' ||
      hostname === 'r.bgm.tv' ||
      hostname === 'bangumi.lol' ||
      hostname.endsWith('.bgm.tv') ||
      hostname.endsWith('.bangumi.tv') ||
      hostname.endsWith('.bangumi.lol')
    );
  } catch {
    return false;
  }
}

type AnimeImageSource = 'direct' | 'server-proxy' | 'custom-baseurl' | 'sakura';

const BANGUMI_IMAGE_FALLBACK_UNTIL_KEY = 'bangumiImageFallbackUntil';
const BANGUMI_IMAGE_FALLBACK_SIGNATURE_KEY = 'bangumiImageFallbackSignature';
const BANGUMI_IMAGE_FALLBACK_DURATION = 60 * 60 * 1000;
/** 探测主源图片域主页超时（404 也算通） */
const BANGUMI_IMAGE_PROBE_TIMEOUT_MS = 5000;
/** 探测成功后的内存缓存，避免列表刷屏时重复探测 */
const BANGUMI_IMAGE_PROBE_OK_TTL_MS = 15 * 60 * 1000;

type BangumiImageProbeCache = {
  signature: string;
  reachable: boolean | null;
  okUntil: number;
  inflight: Promise<boolean> | null;
};

let bangumiImageProbeCache: BangumiImageProbeCache = {
  signature: '',
  reachable: null,
  okUntil: 0,
  inflight: null,
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/** 官方域名 → 桜色镜像站（bgm.tv → bangumi.lol 等） */
function rewriteBangumiUrlToSakura(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'bgm.tv' || hostname === 'bangumi.tv') {
      parsed.hostname = 'bangumi.lol';
    } else if (hostname.endsWith('.bgm.tv')) {
      parsed.hostname = `${hostname.slice(0, -'.bgm.tv'.length)}.bangumi.lol`;
    } else if (hostname.endsWith('.bangumi.tv')) {
      parsed.hostname = `${hostname.slice(
        0,
        -'.bangumi.tv'.length
      )}.bangumi.lol`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeAnimeImageSource(
  value: string | null | undefined
): AnimeImageSource {
  return value === 'server-proxy' ||
    value === 'custom-baseurl' ||
    value === 'direct' ||
    value === 'sakura'
    ? value
    : 'direct';
}

function getPrimaryBangumiImageSource(): AnimeImageSource {
  if (typeof window === 'undefined') {
    return 'direct';
  }

  return normalizeAnimeImageSource(
    localStorage.getItem('animeDataSource') ||
      window.RUNTIME_CONFIG?.BANGUMI_DATA_SOURCE ||
      'direct'
  );
}

function getBackupBangumiImageSource(
  primary: AnimeImageSource
): AnimeImageSource | null {
  if (typeof window === 'undefined') {
    return primary === 'server-proxy' ? null : 'server-proxy';
  }

  const backup = normalizeAnimeImageSource(
    localStorage.getItem('animeDataSourceBackup') || 'server-proxy'
  );

  return backup === primary ? null : backup;
}

function getBangumiImageBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeBaseUrl(localStorage.getItem('animeImageBaseUrl') || '');
}

function getBangumiImageFallbackSignature(): string {
  if (typeof window === 'undefined') return '';

  return JSON.stringify({
    primary: getPrimaryBangumiImageSource(),
    backup: normalizeAnimeImageSource(
      localStorage.getItem('animeDataSourceBackup') || 'server-proxy'
    ),
    imageBaseUrl: getBangumiImageBaseUrl(),
  });
}

function getBangumiImageProbeSignature(): string {
  return JSON.stringify({
    primary: getPrimaryBangumiImageSource(),
    imageBaseUrl: getBangumiImageBaseUrl(),
  });
}

/** 当前主源图片域 origin；server-proxy 无需探测返回 null */
function getBangumiImageProbeOrigin(): string | null {
  const primary = getPrimaryBangumiImageSource();
  switch (primary) {
    case 'server-proxy':
      return null;
    case 'sakura':
      return 'https://lain.bangumi.lol';
    case 'custom-baseurl': {
      const base = getBangumiImageBaseUrl();
      if (!base) return 'https://lain.bgm.tv';
      try {
        return new URL(base).origin;
      } catch {
        return null;
      }
    }
    case 'direct':
    default:
      return 'https://lain.bgm.tv';
  }
}

export function clearBangumiImageProbeCache(): void {
  bangumiImageProbeCache = {
    signature: '',
    reachable: null,
    okUntil: 0,
    inflight: null,
  };
}

/** 仅清除 localStorage 中的 sticky 降级标记，不动内存探测缓存（热路径调用） */
function clearBangumiImageFallbackFlags(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BANGUMI_IMAGE_FALLBACK_UNTIL_KEY);
  localStorage.removeItem(BANGUMI_IMAGE_FALLBACK_SIGNATURE_KEY);
}

export function clearBangumiImageFallbackCache(): void {
  clearBangumiImageFallbackFlags();
  clearBangumiImageProbeCache();
}

export function markBangumiImageFallbackActive(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    BANGUMI_IMAGE_FALLBACK_UNTIL_KEY,
    String(Date.now() + BANGUMI_IMAGE_FALLBACK_DURATION)
  );
  localStorage.setItem(
    BANGUMI_IMAGE_FALLBACK_SIGNATURE_KEY,
    getBangumiImageFallbackSignature()
  );
}

/**
 * 探测主源图片域是否可达：请求 origin 主页（常见 404），5s 超时 + 防缓存。
 * no-cors 下任意完成（含 404）视为可达；超时/DNS/断网视为不可达。
 * 失败时写入 sticky 降级（若有备源）。全局单飞 + 成功缓存 15 分钟。
 * @returns true=主源可用，false=应走备源
 */
export async function ensureBangumiImagePrimaryProbed(): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  if (isBangumiImageFallbackActive()) {
    return false;
  }

  const origin = getBangumiImageProbeOrigin();
  if (!origin) {
    return true;
  }

  const signature = getBangumiImageProbeSignature();
  const now = Date.now();

  if (
    bangumiImageProbeCache.signature === signature &&
    bangumiImageProbeCache.reachable === true &&
    bangumiImageProbeCache.okUntil > now
  ) {
    return true;
  }

  if (
    bangumiImageProbeCache.signature === signature &&
    bangumiImageProbeCache.inflight
  ) {
    return bangumiImageProbeCache.inflight;
  }

  const probePromise = (async (): Promise<boolean> => {
    const url = `${origin}/?_cb=${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    try {
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(BANGUMI_IMAGE_PROBE_TIMEOUT_MS),
      });
      bangumiImageProbeCache = {
        signature,
        reachable: true,
        okUntil: Date.now() + BANGUMI_IMAGE_PROBE_OK_TTL_MS,
        inflight: null,
      };
      return true;
    } catch {
      bangumiImageProbeCache = {
        signature,
        reachable: false,
        okUntil: 0,
        inflight: null,
      };
      const primary = getPrimaryBangumiImageSource();
      if (getBackupBangumiImageSource(primary)) {
        markBangumiImageFallbackActive();
      }
      return false;
    }
  })();

  bangumiImageProbeCache = {
    signature,
    reachable: bangumiImageProbeCache.reachable,
    okUntil: bangumiImageProbeCache.okUntil,
    inflight: probePromise,
  };

  return probePromise;
}

/** 非阻塞触发主源图片域探测（processImageUrl / 首屏侧调用） */
export function scheduleBangumiImagePrimaryProbe(): void {
  if (typeof window === 'undefined') return;
  void ensureBangumiImagePrimaryProbed();
}

function normalizeComparableUrl(url: string): string {
  if (typeof window === 'undefined') return url;

  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

export function clearBangumiImageFallbackCacheIfFailed(
  target: HTMLImageElement,
  originalUrl: string
): boolean {
  if (!originalUrl || !isBangumiImageUrl(originalUrl)) {
    return false;
  }

  const fallbackUrl = getBangumiImageFallbackUrl(originalUrl);
  if (!fallbackUrl) {
    return false;
  }

  const normalizedFallbackUrl = normalizeComparableUrl(fallbackUrl);
  const failedUrls = [target.currentSrc, target.src]
    .filter(Boolean)
    .map(normalizeComparableUrl);
  const isFallbackFailure =
    target.dataset.bangumiBackupTried === 'true' ||
    failedUrls.includes(normalizedFallbackUrl);

  if (!isFallbackFailure) {
    return false;
  }

  target.dataset.bangumiBackupFailed = 'true';
  delete target.dataset.bangumiBackupTried;
  clearBangumiImageFallbackCache();
  return true;
}

function isBangumiImageFallbackActive(): boolean {
  if (typeof window === 'undefined') return false;

  const until = Number(localStorage.getItem(BANGUMI_IMAGE_FALLBACK_UNTIL_KEY));
  if (!until || Date.now() >= until) {
    clearBangumiImageFallbackFlags();
    return false;
  }

  const signature = localStorage.getItem(BANGUMI_IMAGE_FALLBACK_SIGNATURE_KEY);
  if (signature !== getBangumiImageFallbackSignature()) {
    clearBangumiImageFallbackFlags();
    return false;
  }

  return true;
}

function buildBangumiImageUrl(
  originalUrl: string,
  source: AnimeImageSource
): string {
  switch (source) {
    case 'server-proxy':
      return `/api/image-proxy?url=${encodeURIComponent(
        originalUrl
      )}&source=bangumi`;
    case 'custom-baseurl': {
      const imageBaseUrl = getBangumiImageBaseUrl();
      return imageBaseUrl ? `${imageBaseUrl}/${originalUrl}` : originalUrl;
    }
    case 'sakura':
      return rewriteBangumiUrlToSakura(originalUrl);
    case 'direct':
    default:
      return originalUrl;
  }
}

export function getBangumiImageFallbackUrl(originalUrl: string): string | null {
  if (!originalUrl || !isBangumiImageUrl(originalUrl)) {
    return null;
  }

  const primary = getPrimaryBangumiImageSource();
  const backup = getBackupBangumiImageSource(primary);
  if (!backup) {
    return null;
  }

  const primaryUrl = buildBangumiImageUrl(originalUrl, primary);
  const backupUrl = buildBangumiImageUrl(originalUrl, backup);

  if (backupUrl === primaryUrl) {
    return null;
  }

  return backupUrl;
}

export function tryApplyDoubanImageFallback(
  target: HTMLImageElement,
  originalUrl: string
): boolean {
  if (!originalUrl || !originalUrl.includes('doubanio.com')) {
    return false;
  }

  if (target.dataset.doubanBackupTried === 'true') {
    return false;
  }

  const fallbackUrl = getDoubanImageFallbackUrl(originalUrl);
  if (
    !fallbackUrl ||
    fallbackUrl === target.currentSrc ||
    fallbackUrl === target.src
  ) {
    return false;
  }

  target.dataset.doubanBackupTried = 'true';
  target.src = fallbackUrl;
  return true;
}

export function tryApplyBangumiImageFallback(
  target: HTMLImageElement,
  originalUrl: string
): boolean {
  if (!originalUrl || !isBangumiImageUrl(originalUrl)) {
    return false;
  }

  if (target.dataset.bangumiBackupTried === 'true') {
    return false;
  }

  if (target.dataset.bangumiBackupFailed === 'true') {
    return false;
  }

  const fallbackUrl = getBangumiImageFallbackUrl(originalUrl);
  if (
    !fallbackUrl ||
    fallbackUrl === target.currentSrc ||
    fallbackUrl === target.src
  ) {
    return false;
  }

  target.dataset.bangumiBackupTried = 'true';
  markBangumiImageFallbackActive();
  target.src = fallbackUrl;
  return true;
}

/**
 * 处理图片 URL，根据用户设置使用相应的代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 如果已经是代理URL，直接返回
  if (originalUrl.startsWith('/api/image-proxy')) {
    return originalUrl;
  }

  // 处理 TMDB 图片 URL 替换
  if (originalUrl.includes('image.tmdb.org')) {
    if (typeof window !== 'undefined') {
      const tmdbImageBaseUrl = getTmdbImageBaseUrl();
      // 与默认地址一致时无需替换
      if (tmdbImageBaseUrl !== 'https://image.tmdb.org') {
        // 已带有配置的图片前缀时直接返回，避免重复嵌套拼接
        if (originalUrl.startsWith(tmdbImageBaseUrl)) {
          return originalUrl;
        }
        // 仅替换开头的官方图片地址，避免对已拼接的 URL 再次追加前缀
        for (const officialBase of [
          'https://image.tmdb.org',
          'http://image.tmdb.org',
        ]) {
          if (originalUrl.startsWith(officialBase)) {
            return tmdbImageBaseUrl + originalUrl.slice(officialBase.length);
          }
        }
      }
    }
    return originalUrl;
  }

  // 处理 Bangumi 图片代理。直连模式尊重用户选择，不代理图片；
  // 仅在服务器代理 / 自定义 Base URL 模式下使用本站图片代理。
  // sticky 降级中走备源；否则用主源，并非阻塞探测主源图片域主页（5s，404 算通）。
  if (isBangumiImageUrl(originalUrl)) {
    const primary = getPrimaryBangumiImageSource();
    const backup = getBackupBangumiImageSource(primary);
    if (backup && isBangumiImageFallbackActive()) {
      return buildBangumiImageUrl(originalUrl, backup);
    }
    if (primary !== 'server-proxy' && backup) {
      scheduleBangumiImagePrimaryProbe();
    }
    return buildBangumiImageUrl(originalUrl, primary);
  }

  // 处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  return buildDoubanImageUrl(originalUrl, proxyType, proxyUrl);
}

/**
 * 处理视频 URL，根据用户设置使用相应的代理
 */
export function processVideoUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣视频代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  // 获取用户配置的代理设置
  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();

  // 根据代理类型处理URL
  switch (proxyType) {
    case 'direct':
      // 直连，不使用代理
      return originalUrl;

    case 'server':
      // 使用服务器代理
      return `/api/video-proxy?url=${encodeURIComponent(originalUrl)}`;

    case 'img3':
      // 使用 img3.doubanio.com 代理
      return originalUrl.replace(/img\d\.doubanio\.com/g, 'img3.doubanio.com');

    case 'cmliussss-cdn-tencent':
      // 使用腾讯云CDN代理
      return originalUrl.replace(
        /https?:\/\/img\d\.doubanio\.com/g,
        'https://douban-img.cmliussss.workers.dev'
      );

    case 'cmliussss-cdn-ali':
      // 使用阿里云CDN代理
      return originalUrl.replace(
        /https?:\/\/img\d\.doubanio\.com/g,
        'https://douban-img-ali.cmliussss.workers.dev'
      );

    case 'custom':
      // 使用自定义代理
      if (proxyUrl) {
        return originalUrl.replace(
          /https?:\/\/img\d\.doubanio\.com/g,
          proxyUrl
        );
      }
      return originalUrl;

    default:
      // 默认使用腾讯云CDN代理
      return originalUrl.replace(
        /https?:\/\/img\d\.doubanio\.com/g,
        'https://douban-img.cmliussss.workers.dev'
      );
  }
}

/**
 * 将字符串编码为 Base58
 * @param str 要编码的字符串
 * @returns Base58 编码后的字符串
 */
export function base58Encode(str: string): string {
  if (!str) return '';

  // 在浏览器环境中使用 TextEncoder
  if (typeof window !== 'undefined') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return bs58.encode(bytes);
  }

  // 在 Node.js 环境中使用 Buffer
  const buffer = Buffer.from(str, 'utf-8');
  return bs58.encode(buffer);
}

/**
 * 将 Base58 字符串解码为原始字符串
 * @param encoded Base58 编码的字符串
 * @returns 解码后的原始字符串
 */
export function base58Decode(encoded: string): string {
  if (!encoded) return '';

  const bytes = bs58.decode(encoded);

  // 在浏览器环境中使用 TextDecoder
  if (typeof window !== 'undefined') {
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  // 在 Node.js 环境中使用 Buffer
  return Buffer.from(bytes).toString('utf-8');
}
