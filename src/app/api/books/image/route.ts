import { NextRequest, NextResponse } from 'next/server';

import { legadoClient } from '@/lib/legado.client';
import crypto from 'crypto';
import {
  guardedFetch,
  ProxyTargetBlockedError,
  safeImageContentType,
  validateProxyUrlServerSide,
} from '@/lib/server/ssrf';

import { getAuthorizedBooksUsername } from '../_utils';

export const runtime = 'nodejs';

const imageCache = new Map<
  string,
  { expiresAt: number; contentType: string; data: Uint8Array }
>();

function asObjectHeader(
  value?: string | Record<string, string>
): Record<string, string> {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return value.split('\n').reduce<Record<string, string>>((headers, line) => {
      const index = line.indexOf(':');
      if (index > 0)
        headers[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      return headers;
    }, {});
  }
}

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId') || '';
    const url = searchParams.get('url') || '';
    if (!sourceId || !url)
      return NextResponse.json(
        { error: '缺少 sourceId 或 url' },
        { status: 400 }
      );
    if (!(await validateProxyUrlServerSide(url)))
      return NextResponse.json(
        { error: '图片地址未通过安全校验' },
        { status: 400 }
      );
    const source = await legadoClient.getSourceById(sourceId);
    let imageOptions: any = {};
    try {
      const rawOptions = searchParams.get('options') || '';
      imageOptions = rawOptions ? JSON.parse(rawOptions) : {};
    } catch {
      imageOptions = {};
    }
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      Referer: source.legado?.bookSourceUrl || source.url,
      ...asObjectHeader(source.legado?.header),
      ...(imageOptions.headers && typeof imageOptions.headers === 'object'
        ? imageOptions.headers
        : {}),
    };
    delete headers.Host;
    delete headers.host;
    const cacheKey = crypto
      .createHash('sha1')
      .update(`${sourceId}|${url}|${JSON.stringify(imageOptions)}`)
      .digest('hex');
    const cached = imageCache.get(cacheKey);
    if (
      cached &&
      cached.expiresAt > Date.now() &&
      !request.headers.get('range')
    ) {
      return new NextResponse(cached.data, {
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
    const range = request.headers.get('range');
    if (range) headers.Range = range;
    // 逐跳校验重定向：只校验第一跳的话，公网地址可以经第二次跳转进内网
    const res = await guardedFetch(
      url,
      {
        method: imageOptions.method || 'GET',
        headers,
        body: imageOptions.body,
        cache: 'no-store',
      },
      { publicOnly: true }
    );
    if (!res.ok)
      return NextResponse.json(
        { error: `图片请求失败: ${res.status}` },
        { status: res.status }
      );
    const data = new Uint8Array(await res.arrayBuffer());
    // 只透传图片类型，防止书源返回的 HTML 以本站身份运行
    const contentType = safeImageContentType(
      res.headers.get('content-type') || 'image/jpeg'
    );
    if (!range)
      imageCache.set(cacheKey, {
        data,
        contentType,
        expiresAt: Date.now() + 86400_000,
      });
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        ...(res.headers.get('content-range')
          ? { 'Content-Range': res.headers.get('content-range') as string }
          : {}),
        ...(res.headers.get('accept-ranges')
          ? { 'Accept-Ranges': res.headers.get('accept-ranges') as string }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof ProxyTargetBlockedError)
      return NextResponse.json(
        { error: '图片重定向地址未通过安全校验' },
        { status: 400 }
      );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片代理失败' },
      { status: 500 }
    );
  }
}
