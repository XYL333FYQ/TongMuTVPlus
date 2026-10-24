// 登录 / 注册完成后的回跳地址只允许同源 HTTP(S)，
// 防止 ?redirect=https://外站 把刚登录的用户带走（开放重定向）。
export function getSafeRedirect(
  value: string | null | undefined,
  fallback = '/'
): string {
  if (!value || typeof window === 'undefined') return fallback;
  try {
    const target = new URL(value, window.location.href);
    if (
      target.origin === window.location.origin &&
      (target.protocol === 'http:' || target.protocol === 'https:')
    ) {
      return `${target.origin}${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // 无法解析的地址按默认页处理
  }
  return fallback;
}

// searchParams.get() 已经解码过一次；部分来源会再编码一层，
// 这里尝试再解一次，遇到 “100%” 这类非法序列时保留原文而不是抛错白屏。
export function decodeQueryText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
