/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import {
  guardedFetch,
  hostsOf,
  ProxyTargetBlockedError,
  safeImageContentType,
} from '@/lib/server/ssrf';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const source =
    searchParams.get('moontv-source') || searchParams.get('source');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  const ua = liveSource?.ua || 'AptvPlayer/1.4.10';
  // 站长配置的直播源主机（含局域网 IPTV）可以代理，其他内网地址一律拒绝
  const trustedHosts = hostsOf([liveSource?.url, liveSource?.epg]);

  try {
    const decodedUrl = decodeURIComponent(imageUrl);
    const imageResponse = await guardedFetch(
      decodedUrl,
      {
        cache: 'no-cache',
        redirect: 'follow',
        credentials: 'same-origin',
        headers: {
          'User-Agent': ua,
        },
      },
      { trustedHosts }
    );

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: imageResponse.statusText },
        { status: imageResponse.status }
      );
    }

    // 只透传图片类型，防止上游返回网页时以本站身份执行脚本
    const contentType = safeImageContentType(
      imageResponse.headers.get('content-type')
    );

    if (!imageResponse.body) {
      return NextResponse.json(
        { error: 'Image response has no body' },
        { status: 500 }
      );
    }

    // 创建响应头
    const headers = new Headers();
    headers.set('Content-Type', contentType);

    // 设置缓存头
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400'); // 缓存一天

    // 直接返回图片流
    return new Response(imageResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof ProxyTargetBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Error fetching image' },
      { status: 500 }
    );
  }
}
