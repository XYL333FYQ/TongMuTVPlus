// 游客可用的海报中转白名单。
//
// 首页、片库、搜索页游客也能看，海报主要来自豆瓣。豆瓣会拒绝浏览器直接引用（HTTP 418），
// 需要本站 /api/image-proxy 带上合适的来源头去取。以前这个接口要登录，游客的海报只能
// 先撞墙再失败。现在对游客放开，但只允许下面这几个海报图床——中转不能被拿去代理任意网址。
// 登录用户不受此限制（仍走原有的内网防护）。

const GUEST_POSTER_HOST_SUFFIXES = [
  'doubanio.com', // 豆瓣海报 img1~img9.doubanio.com
  'image.tmdb.org', // TMDB 海报
  'bgm.tv', // Bangumi 封面 lain.bgm.tv
  'bangumi.tv',
];

function hostMatches(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** 这个图片地址能不能给游客中转：只认 http(s) + 白名单图床，不带账号密码、只用默认端口。 */
export function isGuestPosterUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password || url.port) return false;
  const hostname = url.hostname.toLowerCase();
  return GUEST_POSTER_HOST_SUFFIXES.some((suffix) =>
    hostMatches(hostname, suffix)
  );
}

/** 游客请求 /api/image-proxy 是否放行：只放 GET、只放白名单图床。 */
export function isGuestImageProxyRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  return (
    method === 'GET' &&
    pathname === '/api/image-proxy' &&
    isGuestPosterUrl(searchParams.get('url'))
  );
}
