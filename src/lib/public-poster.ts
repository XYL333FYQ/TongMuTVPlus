// 游客页面（首页、片库、短剧）的海报取图顺序。
//
// 本机实测（2026-10-30，未登录，12 张豆瓣海报）：浏览器直连豆瓣几乎全部被拒（HTTP 418），
// 公共镜像全部成功（约 1～1.5 秒），本站中转也能成功。所以顺序改为：
//   1. 站长设定的公开镜像（游客拿到的是去掉私密地址后的方式名，见 public-runtime-config.ts）
//   2. 本站中转 /api/image-proxy（游客只能中转豆瓣/TMDB/Bangumi 图床）
//   3. 直连原图（不带来源头，偶尔能成）
// 全部失败才显示占位。不读用户本地的代理设置，游客页与登录状态无关。

const DOUBAN_HOST = /img\d+\.doubanio\.com/g;

function mirrorFor(src: string, type: string | undefined): string | null {
  switch (type) {
    case 'cmliussss-cdn-ali':
      return src.replace(DOUBAN_HOST, 'img.doubanio.cmliussss.com');
    case 'img3':
      return src.replace(DOUBAN_HOST, 'img3.doubanio.com');
    case 'server':
    case 'direct':
      return null;
    case 'cmliussss-cdn-tencent':
    default:
      return src.replace(DOUBAN_HOST, 'img.doubanio.cmliussss.net');
  }
}

function runtimeImageProxyType(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const type = (window as { RUNTIME_CONFIG?: Record<string, unknown> })
    .RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE;
  return typeof type === 'string' ? type : undefined;
}

/** 按顺序列出可尝试的海报地址（已去重）。第一个用于首次加载，失败后依次换下一个。 */
export function publicPosterCandidates(
  src: string,
  type: string | undefined = runtimeImageProxyType()
): string[] {
  if (!src) return [];
  const remote = /^https?:\/\//.test(src);
  const relay = remote
    ? `/api/image-proxy?url=${encodeURIComponent(src)}`
    : null;
  const isDouban = remote && /img\d+\.doubanio\.com/.test(src);
  const list: Array<string | null> = isDouban
    ? type === 'direct'
      ? // 站长明确选了直连：尊重，失败再走中转
        [src, relay]
      : [mirrorFor(src, type), relay, src]
    : // TMDB 等其它图床直连通常可用，失败再走中转
      [src, relay];
  return Array.from(new Set(list.filter((item): item is string => !!item)));
}
