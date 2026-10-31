/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 权限检查：仅站长可以拉取配置订阅
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authInfo.username !== process.env.USERNAME) {
      return NextResponse.json(
        { error: '权限不足，只有站长可以拉取配置订阅' },
        { status: 401 }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: '缺少URL参数' }, { status: 400 });
    }

    // 只允许 http(s)，并限时 15 秒：防止填错地址（file:、data: 等）或对方不响应时一直挂着。
    // 内网地址仍允许：站长可能把订阅放在局域网里；别的网站诱导站长浏览器发起的请求已由中间件拦截。
    let target: URL;
    try {
      target = new URL(String(url));
    } catch {
      return NextResponse.json(
        { error: '订阅地址格式不正确' },
        { status: 400 }
      );
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      return NextResponse.json(
        { error: '订阅地址只支持 http 或 https' },
        { status: 400 }
      );
    }
    const response = await fetch(target.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `请求失败: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const configContent = await response.text();

    // 对 configContent 进行 base58 解码
    let decodedContent;
    try {
      const bs58 = (await import('bs58')).default;
      const decodedBytes = bs58.decode(configContent);
      decodedContent = new TextDecoder().decode(decodedBytes);
    } catch (decodeError) {
      console.warn('Base58 解码失败', decodeError);
      throw decodeError;
    }

    return NextResponse.json({
      success: true,
      configContent: decodedContent,
      message: '配置拉取成功',
    });
  } catch (error) {
    console.error('拉取配置失败:', error);
    return NextResponse.json({ error: '拉取配置失败' }, { status: 500 });
  }
}
