import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { isTVModeEnabled } from '@/lib/tv-mode';
// tv-remote-hub 是 server.js 也在用的 CommonJS 模块，状态挂在 globalThis 上，两边拿到同一份
import { sendTVRemoteCommand } from '@/lib/tv-remote-hub';
import type { TVRemoteTextCommand } from '@/lib/tv-remote-types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isTVModeEnabled()) {
    return NextResponse.json({ error: 'TV 模式未启用' }, { status: 404 });
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    deviceId?: string;
    command?: TVRemoteTextCommand;
  } | null;

  if (!body?.deviceId || !body.command?.mode) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const result = sendTVRemoteCommand(
    authInfo.username,
    body.deviceId,
    'tv-remote:text',
    body.command
  );

  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}
