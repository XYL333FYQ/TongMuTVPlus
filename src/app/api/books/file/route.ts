import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { bookProvider } from '@/lib/book-provider';
import type { BookSource } from '@/lib/book.types';
import { hostsOf, isProxyTargetAllowed } from '@/lib/server/ssrf';

import { getAuthorizedBooksUsername } from '../_utils';

export const runtime = 'nodejs';

type FilePayload = {
  sourceId?: string;
  bookId?: string;
  href?: string;
  format?: 'epub' | 'pdf' | 'chapters' | null;
};

async function resolveFileHref(
  username: string,
  payload: FilePayload
): Promise<{ sourceId: string; href: string }> {
  const sourceId = payload.sourceId?.trim();
  if (!sourceId) throw new Error('缺少 sourceId');
  if (payload.format === 'chapters')
    throw new Error('章节型书源不提供文件下载');

  if (payload.href?.trim()) {
    return { sourceId, href: payload.href.trim() };
  }

  const bookId = payload.bookId?.trim();
  if (!bookId) throw new Error('缺少 bookId 或 href');

  const shelfItem = await db.getBookShelf(username, sourceId, bookId);
  const readRecord = await db.getBookReadRecord(username, sourceId, bookId);
  const directHref = shelfItem?.acquisitionHref || readRecord?.acquisitionHref;
  if (directHref) {
    return { sourceId, href: directHref };
  }

  const detailHref = shelfItem?.detailHref || readRecord?.detailHref;
  if (!detailHref) throw new Error('找不到可下载文件');

  const preferred = await bookProvider.getPreferredAcquisition(
    sourceId,
    detailHref
  );
  if (preferred.format === 'chapters')
    throw new Error('章节型书源不提供文件下载');
  if (payload.format && preferred.format !== payload.format) {
    const detail = await bookProvider.getBookDetail(sourceId, detailHref);
    const matched = detail.acquisitionLinks.find((item) =>
      payload.format === 'pdf'
        ? item.type.toLowerCase().includes('pdf')
        : item.type.toLowerCase().includes('epub')
    );
    if (!matched?.href) throw new Error('找不到对应格式文件');
    return { sourceId, href: matched.href };
  }

  return { sourceId, href: preferred.href };
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// 书源配置的登录信息（Basic 或自定义请求头）
function sourceAuthHeaders(source: BookSource): Record<string, string> {
  if (source.authMode === 'basic' && source.username) {
    return {
      Authorization: `Basic ${Buffer.from(
        `${source.username}:${source.password || ''}`
      ).toString('base64')}`,
    };
  }
  if (source.authMode === 'header' && source.headerName && source.headerValue) {
    return { [source.headerName]: source.headerValue };
  }
  return {};
}

const MAX_REDIRECTS = 5;

async function proxyFile(request: NextRequest, sourceId: string, href: string) {
  const source = await bookProvider.getSourceById(sourceId);
  const sourceOrigin = originOf(source.url);
  // 书源本身可以在内网（自建 OPDS 很常见），其他地址必须是公网
  const trustedHosts = hostsOf([source.url]);
  const range = request.headers.get('range');

  // 手动跟随重定向：每一跳都校验目标；书源的登录信息只发给书源自己的地址，
  // 否则调用方填一个别的 href 就能把站长配置的账号密码发到任意服务器
  let current = href;
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isProxyTargetAllowed(current, trustedHosts)))
      throw new Error('文件地址未通过安全校验');
    const headers = new Headers(
      sourceOrigin && originOf(current) === sourceOrigin
        ? sourceAuthHeaders(source)
        : {}
    );
    if (range) headers.set('Range', range);
    const hopResponse = await fetch(current, {
      headers,
      redirect: 'manual',
      cache: 'no-store',
    });
    const location = hopResponse.headers.get('location');
    if (hopResponse.status >= 300 && hopResponse.status < 400 && location) {
      await hopResponse.body?.cancel().catch(() => undefined);
      current = new URL(location, current).toString();
      continue;
    }
    response = hopResponse;
    break;
  }
  if (!response) throw new Error('文件地址重定向次数过多');

  if (!response.ok) {
    return NextResponse.json(
      { error: `文件代理失败: ${response.status}` },
      { status: response.status }
    );
  }

  const outHeaders = new Headers();
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');
  const acceptRanges = response.headers.get('accept-ranges');
  const contentRange = response.headers.get('content-range');
  const disposition = response.headers.get('content-disposition');
  const normalizedHref = href.toLowerCase();
  const resolvedContentType =
    contentType ||
    (normalizedHref.endsWith('.pdf')
      ? 'application/pdf'
      : normalizedHref.endsWith('.epub')
      ? 'application/epub+zip'
      : '');
  if (resolvedContentType) outHeaders.set('Content-Type', resolvedContentType);
  if (contentLength) outHeaders.set('Content-Length', contentLength);
  if (acceptRanges) outHeaders.set('Accept-Ranges', acceptRanges);
  if (contentRange) outHeaders.set('Content-Range', contentRange);
  if (disposition) outHeaders.set('Content-Disposition', disposition);
  outHeaders.set('Cache-Control', 'private, max-age=300');

  return new NextResponse(response.body, {
    status: response.status,
    headers: outHeaders,
  });
}

export async function GET(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveFileHref(username, {
      sourceId: searchParams.get('sourceId') || undefined,
      bookId: searchParams.get('bookId') || undefined,
      href: searchParams.get('href') || undefined,
      format:
        (searchParams.get('format')?.trim() as
          | 'epub'
          | 'pdf'
          | 'chapters'
          | null) || null,
    });
    return await proxyFile(request, resolved.sourceId, resolved.href);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const username = await getAuthorizedBooksUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const payload = (await request.json()) as FilePayload;
    const resolved = await resolveFileHref(username, payload);
    return await proxyFile(request, resolved.sourceId, resolved.href);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
