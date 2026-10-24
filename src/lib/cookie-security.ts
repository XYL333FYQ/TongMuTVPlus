import type { NextRequest } from 'next/server';

// 站点通过 HTTPS 访问时（含反向代理终止 TLS 的情况），登录 Cookie 加上 Secure，
// 防止它在明文 HTTP 请求里被带出去；本地 http://localhost 开发不受影响。
export function isSecureRequest(request: NextRequest): boolean {
  if (request.nextUrl?.protocol === 'https:') return true;
  const forwarded = request.headers.get('x-forwarded-proto') || '';
  return forwarded.split(',')[0].trim().toLowerCase() === 'https';
}
