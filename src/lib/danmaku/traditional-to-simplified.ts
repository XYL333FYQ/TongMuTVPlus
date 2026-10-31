/* 繁简转换 —— 独立客户端模块。
 *
 * opencc-js 的字典很大（解压后约 1.1MB，压缩后约 480KB）。以前这里静态导入它，
 * 而本文件被全站播放器、账号菜单间接引用，于是每个页面一打开都要先下载这本字典。
 * 现在改为"用到才下载"：
 *   - 开了"弹幕繁转简"的用户：页面加载后在后台下载（与以前效果一致，只是不挡首屏）；
 *   - 搜索页需要时自己调用 loadTraditionalToSimplifiedConverter() 等它下载完；
 *   - 其余用户永远不下载。
 * 服务端构建（Cloudflare）仍由 next.config.js 的 alias 把 opencc-js 指向空实现。
 */

type OpenCCConverter = (text: string) => string;

const SETTING_KEY = 'danmakuTraditionalToSimplified';

let danmakuConverter: OpenCCConverter | null = null;
let danmakuConverterPromise: Promise<OpenCCConverter | null> | null = null;

/**
 * 加载繁简转换器（from: hk → to: cn）。同一进程只加载一次。
 * 仅客户端可调用；服务端（SSR）下 window 未定义时由调用方自行保护。
 */
export function loadTraditionalToSimplifiedConverter(): Promise<OpenCCConverter | null> {
  if (danmakuConverter) return Promise.resolve(danmakuConverter);
  if (!danmakuConverterPromise) {
    danmakuConverterPromise = import('opencc-js')
      .then(({ Converter }) => {
        danmakuConverter = Converter({ from: 'hk', to: 'cn' });
        return danmakuConverter;
      })
      .catch((error) => {
        console.error('初始化繁简转换器失败:', error);
        danmakuConverter = null;
        // 允许下次再试（比如网络恢复后）
        danmakuConverterPromise = null;
        return null;
      });
  }
  return danmakuConverterPromise;
}

/** 已下载好的转换器；还没下载时返回 null（不会触发下载）。 */
export function getLoadedTraditionalToSimplifiedConverter(): OpenCCConverter | null {
  return danmakuConverter;
}

function conversionEnabled(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) === 'true';
  } catch {
    return false;
  }
}

// 开了"弹幕繁转简"的用户：页面空闲后在后台预热，播放时通常已就绪
if (typeof window !== 'undefined' && conversionEnabled()) {
  const warm = () => void loadTraditionalToSimplifiedConverter();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1000);
  }
}

export function convertDanmakuText(text: string): string {
  if (typeof window === 'undefined' || !conversionEnabled()) {
    return text;
  }

  // 转换器尚未就绪：这次原样返回，同时开始加载，后续弹幕即可转换
  if (!danmakuConverter) {
    void loadTraditionalToSimplifiedConverter();
    return text;
  }

  try {
    return danmakuConverter(text);
  } catch (error) {
    console.error('弹幕繁简转换失败:', error);
    return text;
  }
}
