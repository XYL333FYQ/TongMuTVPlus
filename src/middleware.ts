/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { authenticateRequest } from '@/lib/request-auth';
import { isTVModeEnabled, resolveLoginPath } from '@/lib/tv-mode';

const PUBLIC_PAGES = new Set(['/', '/douban', '/duanju', '/search', '/watch-room', '/about']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isTVModeEnabled() && isTVModePath(pathname)) {
    return new NextResponse('Not Found', { status: 404 });
  }
  if (shouldSkipAuth(pathname) ||
      (request.method === 'GET' && PUBLIC_PAGES.has(pathname)) ||
      (request.method === 'GET' && pathname === '/api/public/catalog') ||
      (request.method === 'GET' && pathname === '/api/rooms' && request.nextUrl.searchParams.get('mode') === 'public')) {
    return NextResponse.next();
  }
  if (!process.env.PASSWORD && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/warning', request.url));
  }
  if (!(await authenticateRequest(request))) return handleAuthFailure(request, pathname);
  return NextResponse.next();
}

// 处理认证失败的情况
function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  // 如果是 API 路由，返回 401 状态码
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // TV 端页面未授权时进入电视扫码登录页
  const loginUrl = new URL(resolveLoginPath(pathname), request.url);
  // 保留完整的URL，包括查询参数
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  loginUrl.searchParams.set('returnTo', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 判断是否需要跳过认证的路径
function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/brand/',
    '/logo.png',
    '/screenshot.png',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

function isTVModePath(pathname: string): boolean {
  return pathname === '/tv' || pathname.startsWith('/tv/') || pathname.startsWith('/api/tv-remote/');
}

// 配置middleware匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|oidc-register|qr-login|warning|tv/login|api/login|api/register|api/logout|api/auth/oidc|api/auth/qr|api/auth/refresh|api/telegram/login|api/telegram/config|api/telegram/webhook|api/cron/|api/server-config|api/proxy-m3u8|api/proxy/vod/segment|api/cms-proxy|api/tvbox/subscribe|api/theme/css|api/openlist/cms-proxy|api/openlist/play/|api/openlist/proxy|api/emby/cms-proxy|api/emby/play|api/emby/subtitle|api/emby/image/|tvbox/).*)',
  ],
};
