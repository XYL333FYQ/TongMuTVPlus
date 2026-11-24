import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { isTVModeEnabled } from '@/lib/tv-mode';
// tv-remote-hub 是 server.js 也在用的 CommonJS 模块，状态挂在 globalThis 上，两边拿到同一份
import { listTVRemoteDevices } from '@/lib/tv-remote-hub';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!isTVModeEnabled()) {
    return NextResponse.json({ error: 'TV 模式未启用' }, { status: 404 });
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  return NextResponse.json({
    devices: listTVRemoteDevices(authInfo.username),
  });
}
