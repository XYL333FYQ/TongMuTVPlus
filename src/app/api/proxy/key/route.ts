/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import {
  guardedFetch,
  hostsOf,
  ProxyTargetBlockedError,
} from '@/lib/server/ssrf';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  if (!liveSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = liveSource.ua || 'AptvPlayer/1.4.10';
  // 站长配置的直播源主机（含局域网 IPTV）可以代理，其他内网地址一律拒绝
  const trustedHosts = hostsOf([liveSource?.url, liveSource?.epg]);

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log(decodedUrl);
    const response = await guardedFetch(
      decodedUrl,
      {
        headers: {
          'User-Agent': ua,
        },
      },
      { trustedHosts }
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch key' },
        { status: 500 }
      );
    }
    const keyData = await response.arrayBuffer();
    return new Response(keyData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    if (error instanceof ProxyTargetBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 });
  }
}
