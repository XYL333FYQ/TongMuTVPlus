import { NextRequest, NextResponse } from 'next/server';

import { clientDownloadBase, clientDownloadUrl } from '@/lib/client-downloads';
import { isValidBuild } from '@/lib/client-update';

export const dynamic = 'force-dynamic';

// 只读：告诉客户端"最新那批安装包是几点构建的、去哪下载"。
// 清单 client-<平台>.json 由打包流水线在发布时和安装包放在一起；这里每 10 分钟读一次并缓存，
// 用户的设备不直接访问 GitHub。文件名由本站按平台写死，不采用清单里的文件名。
const FILES = {
  android: 'TongMuTV-Plus-Android.apk',
  windows: 'TongMuTV-Plus-Windows-x64-Setup.exe',
} as const;
type Platform = keyof typeof FILES;

const TTL = 10 * 60 * 1000;
const cache = new Map<Platform, { at: number; build: string | null }>();

async function readLatestBuild(platform: Platform): Promise<string | null> {
  const hit = cache.get(platform);
  if (hit && Date.now() - hit.at < TTL) return hit.build;
  let build: string | null = null;
  try {
    const base = clientDownloadBase(process.env.CLIENT_DOWNLOAD_BASE_URL);
    const response = await fetch(`${base}/client-${platform}.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const data = await response.json();
      if (isValidBuild(data?.build)) build = data.build;
    }
  } catch {
    // 读不到清单（离线、还没发布过）：当作没有新版本，下次再试
  }
  cache.set(platform, { at: Date.now(), build });
  return build;
}

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform');
  if (platform !== 'android' && platform !== 'windows') {
    return NextResponse.json({ error: '不支持的平台' }, { status: 400 });
  }
  const build = await readLatestBuild(platform);
  return NextResponse.json({
    build,
    url: build
      ? clientDownloadUrl(FILES[platform], process.env.CLIENT_DOWNLOAD_BASE_URL)
      : null,
  });
}
