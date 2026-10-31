// 本机转码助手用的临时凭证。
//
// 播放页的"本机转码"会把站内受保护的播放地址交给用户电脑上的转码程序去拉流，
// 转码程序需要带上登录凭证。登录凭证现在脚本读不到（见 lib/auth-cookie.ts），
// 这里按需发一份"短效副本"：签名、身份、签发时间与原凭证相同，因此只在原凭证的
// 访问有效期内（最长 4 小时）可用；续期令牌换成占位值，拿去 /api/auth/refresh
// 也续不了期。即使被页面里的恶意脚本拿到，也换不来长期登录。
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // 只给本站页面自己用：浏览器标明是跨站发起的请求一律拒绝
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // 中间件已校验过凭证签名；这里只取出内容
  const info = getAuthInfoFromCookie(request);
  if (!info) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const copy = info.refreshToken
    ? { ...info, refreshToken: 'transcoder' }
    : // 本地存储模式没有续期令牌，凭证本身就是访问密码，只能原样给
      info;
  return NextResponse.json(
    { cookie: `auth=${encodeURIComponent(JSON.stringify(copy))}` },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
