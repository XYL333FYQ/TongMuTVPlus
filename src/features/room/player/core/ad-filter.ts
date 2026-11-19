/*
 * m3u8 去广告：管理员可以在后台下发自定义过滤代码（带版本号缓存在本机），
 * 没有或出错时用默认关键字规则。
 */

const CODE_CACHE_KEY = 'custom_ad_filter_code_cache';
const VERSION_CACHE_KEY = 'custom_ad_filter_version_cache';

const AD_KEYWORDS = [
  'sponsor',
  '/ad/',
  '/ads/',
  'advert',
  'advertisement',
  '/adjump',
  'redtraffic',
];

let customCode = '';

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 页面加载时调用一次：读取缓存并按后台版本号更新自定义过滤代码 */
export async function syncCustomAdFilter(version: number) {
  const cached = readStorage(CODE_CACHE_KEY);
  if (cached) customCode = cached;
  try {
    if (!version) {
      localStorage.removeItem(CODE_CACHE_KEY);
      localStorage.removeItem(VERSION_CACHE_KEY);
      customCode = '';
      return;
    }
    const cachedVersion = readStorage(VERSION_CACHE_KEY);
    if (cachedVersion && parseInt(cachedVersion, 10) === version) return;
    const response = await fetch('/api/ad-filter?full=true');
    if (!response.ok) return;
    const { code } = (await response.json()) as { code?: string };
    if (code) {
      localStorage.setItem(CODE_CACHE_KEY, code);
      localStorage.setItem(VERSION_CACHE_KEY, String(version));
      customCode = code;
    } else if (!cached) {
      localStorage.removeItem(CODE_CACHE_KEY);
      localStorage.removeItem(VERSION_CACHE_KEY);
    }
  } catch {
    // 网络失败时继续用缓存
  }
}

/** 后台代码可能带 TS 类型标注，执行前去掉 */
function stripTypes(code: string) {
  return code
    .replace(
      /(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*([,)])/g,
      '$1$3'
    )
    .replace(
      /\)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*\{/g,
      ') {'
    )
    .replace(
      /(const|let|var)\s+(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*=/g,
      '$1 $2 ='
    );
}

export function defaultAdFilter(content: string) {
  if (!content) return '';
  const lines = content.split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('#EXT-X-DISCONTINUITY')) continue;
    if (line.includes('#EXTINF:') && i + 1 < lines.length) {
      const next = lines[i + 1].toLowerCase();
      if (AD_KEYWORDS.some((keyword) => next.includes(keyword))) {
        i++;
        continue;
      }
    }
    kept.push(line);
  }
  return kept.join('\n');
}

export function filterAds(source: string, content: string): string {
  if (customCode.trim()) {
    try {
      // 管理员在后台配置的过滤函数
      // eslint-disable-next-line no-new-func
      const run = new Function(
        'type',
        'm3u8Content',
        `${stripTypes(
          customCode
        )}\nreturn filterAdsFromM3U8(type, m3u8Content);`
      );
      return run(source, content);
    } catch {
      // 自定义代码出错就用默认规则
    }
  }
  return defaultAdFilter(content);
}

/** 生成会过滤 m3u8 清单的 hls.js loader */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdFilterLoader(Hls: any, getSource: () => string) {
  return class AdFilterLoader extends Hls.DefaultConfig.loader {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.load = (context: any, loadConfig: any, callbacks: any) => {
        if (context.type === 'manifest' || context.type === 'level') {
          const onSuccess = callbacks.onSuccess;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callbacks.onSuccess = (response: any, stats: any, ctx: any) => {
            if (typeof response.data === 'string')
              response.data = filterAds(getSource(), response.data);
            return onSuccess(response, stats, ctx, null);
          };
        }
        load(context, loadConfig, callbacks);
      };
    }
  };
}
