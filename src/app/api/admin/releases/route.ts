import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { parseReleaseInfo } from '@/lib/release-info';
import { getReleaseSnapshot, publishRelease } from '@/lib/server/release-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorize(request: NextRequest) {
  const auth = getAuthInfoFromCookie(request);
  if (!auth?.username)
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (!process.env.USERNAME || auth.username !== process.env.USERNAME)
    return NextResponse.json(
      { error: '只有站长可以维护版本与发布记录' },
      { status: 403 }
    );
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  )
    return NextResponse.json(
      { error: '当前存储模式不支持保存站点配置' },
      { status: 400 }
    );
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const snapshot = await getReleaseSnapshot();
    return NextResponse.json(snapshot.info, {
      headers: { 'Cache-Control': 'no-store', ETag: snapshot.etag },
    });
  } catch {
    return NextResponse.json(
      { error: '读取发布记录失败，请重试' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  const expected = request.headers.get('if-match');
  if (!expected)
    return NextResponse.json(
      { error: '请先重新加载发布记录再保存' },
      { status: 428 }
    );
  // 复用站内 Cookie 登录；额外拒绝浏览器跨站提交。
  const origin = request.headers.get('origin');
  // 反向代理转发后 request URL 可能是内部主机，使用代理保留的公开主机/协议。
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    request.headers.get('host') ||
    request.nextUrl.host;
  const protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ||
    request.nextUrl.protocol.replace(':', '');
  if (origin && origin !== `${protocol}://${host}`)
    return NextResponse.json({ error: '不允许跨站保存' }, { status: 403 });
  let release;
  try {
    const text = await request.text();
    if (text.length > 150000) throw new Error('发布记录内容过长');
    release = parseReleaseInfo(JSON.parse(text));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SyntaxError
            ? '提交的数据格式不正确'
            : (error as Error).message,
      },
      { status: 400 }
    );
  }
  try {
    const snapshot = await publishRelease(release, expected);
    if (!snapshot)
      return NextResponse.json(
        {
          error:
            '发布记录已被其他窗口更新。草稿已保留，请复制需要的内容后重新加载。',
        },
        { status: 409 }
      );
    return NextResponse.json(snapshot.info, {
      headers: { 'Cache-Control': 'no-store', ETag: snapshot.etag },
    });
  } catch {
    return NextResponse.json(
      { error: '保存发布记录失败，修改尚未发布，请重试' },
      { status: 500 }
    );
  }
}
