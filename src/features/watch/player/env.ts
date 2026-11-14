/*
 * 播放环境检测：只在浏览器里调用。
 * 这些判断决定用 hls.js 还是浏览器原生 HLS、要不要绕开 iOS 系统全屏等。
 */

export interface PlayerEnvironment {
  /** Safari / iOS 等 WebKit 内核：切换片源需要重建播放器 */
  webkit: boolean;
  ios: boolean;
  harmony: boolean;
  /** 浏览器能直接播放 m3u8（Safari、Edge、鸿蒙） */
  nativeHls: boolean;
  /** 支持 WebGPU（Anime4K 超分需要） */
  webgpu: boolean;
}

function detectIOS() {
  const ua = navigator.userAgent;
  if ((window as unknown as { MSStream?: unknown }).MSStream) return false;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ 的桌面模式 UA 与 Mac 相同，只能靠触摸判断
  return (
    ua.includes('Mac OS X') &&
    'ontouchend' in document &&
    !ua.includes('Windows') &&
    !ua.includes('Linux')
  );
}

function detectNativeHls() {
  try {
    const result = document
      .createElement('video')
      .canPlayType?.('application/vnd.apple.mpegurl');
    return result === 'probably' || result === 'maybe';
  } catch {
    return false;
  }
}

let cached: PlayerEnvironment | null = null;

export function playerEnvironment(): PlayerEnvironment {
  if (cached) return cached;
  if (typeof window === 'undefined')
    return {
      webkit: false,
      ios: false,
      harmony: false,
      nativeHls: false,
      webgpu: false,
    };
  cached = {
    webkit:
      typeof (
        window as unknown as { webkitConvertPointFromNodeToPage?: unknown }
      ).webkitConvertPointFromNodeToPage === 'function',
    ios: detectIOS(),
    harmony: /OpenHarmony/i.test(navigator.userAgent),
    nativeHls: detectNativeHls(),
    webgpu: 'gpu' in navigator,
  };
  return cached;
}

/** 仅测试使用 */
export function resetPlayerEnvironmentForTest(value?: PlayerEnvironment) {
  cached = value || null;
}

/** Safari 判断（含 iOS 上的所有浏览器） */
export function isSafariLike() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iosWebKit =
    /iPad|iPhone|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  return (
    iosWebKit ||
    (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/i.test(ua))
  );
}
