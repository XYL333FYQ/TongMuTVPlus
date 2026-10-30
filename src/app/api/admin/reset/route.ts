/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { resetConfig } from '@/lib/config';
import { isCrossSiteRequest } from '@/lib/request-origin';

export const runtime = 'nodejs';

// 改动配置的操作用 POST（页面已改用 POST）。保留 GET 兼容旧脚本，
// 但拒绝浏览器标明的跨站请求：防止站长登录时点开别人的链接就把配置重置了。
export async function GET(request: NextRequest) {
  if (isCrossSiteRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  if (username !== process.env.USERNAME) {
    return NextResponse.json({ error: '仅支持站长重置配置' }, { status: 401 });
  }

  try {
    await resetConfig();

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 管理员配置不缓存
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: '重置管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
