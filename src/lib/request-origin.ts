// 识别"别的网站让浏览器发来的请求"（跨站请求伪造的典型来路）。
//
// 只看浏览器自己加的 Sec-Fetch-Site 头：网页脚本改不了它，也不受反向代理改写
// Host 的影响。值为 cross-site 才拦；同站、同源、用户直接打开（none）都放行。
// 没有这个头的请求（App、命令行、旧浏览器）照常放行，由登录校验把关。
export function isCrossSiteRequest(request: { headers: Headers }): boolean {
  return request.headers.get('sec-fetch-site') === 'cross-site';
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 会改动数据的接口请求（非 GET/HEAD/OPTIONS）且来自别的网站 */
export function isCrossSiteWrite(request: {
  method: string;
  headers: Headers;
}): boolean {
  return !SAFE_METHODS.has(request.method) && isCrossSiteRequest(request);
}
