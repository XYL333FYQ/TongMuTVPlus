/* eslint-disable @typescript-eslint/no-explicit-any */

import { HttpsProxyAgent } from 'https-proxy-agent';
import { NextResponse } from 'next/server';
import nodeFetch from 'node-fetch';

import { getConfig } from '@/lib/config';
import {
  guardedFetch,
  isProxyTargetAllowed,
  ProxyTargetBlockedError,
  safeImageContentType,
} from '@/lib/server/ssrf';

export const runtime = 'nodejs';

function isCloudflareEnvironment(): boolean {
  return (
    process.env.CF_PAGES === '1' || process.env.BUILD_TARGET === 'cloudflare'
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function applyBangumiImageBaseUrl(
  imageUrl: string,
  imageBaseUrl?: string
): string {
  const normalizedBaseUrl = normalizeBaseUrl(imageBaseUrl || '');
  if (!normalizedBaseUrl) {
    return imageUrl;
  }

  if (imageUrl.startsWith(`${normalizedBaseUrl}/`)) {
    return imageUrl;
  }

  return `${normalizedBaseUrl}/${imageUrl}`;
}

function isBangumiImageUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'lain.bgm.tv' ||
      hostname === 'r.bgm.tv' ||
      hostname === 'bangumi.lol' ||
      hostname.endsWith('.bgm.tv') ||
      hostname.endsWith('.bangumi.tv') ||
      hostname.endsWith('.bangumi.lol')
    );
  } catch {
    return false;
  }
}

async function fetchImage(
  imageUrl: string,
  options?: { source?: string }
): Promise<Response> {
  const isBangumiImage =
    options?.source === 'bangumi' || isBangumiImageUrl(imageUrl);
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    Referer: isBangumiImage ? 'https://bgm.tv/' : 'https://movie.douban.com/',
  };

  const config = isBangumiImage ? await getConfig() : null;
  const targetUrl = isBangumiImage
    ? applyBangumiImageBaseUrl(imageUrl, config?.SiteConfig.BangumiImageBaseUrl)
    : imageUrl;

  if (!isBangumiImage || isCloudflareEnvironment()) {
    // 逐跳校验目标，禁止借图片代理访问服务器内网
    return guardedFetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
  }

  // Bangumi 图片可能走站长配置的出口代理：仍先确认目标是公网地址
  if (!(await isProxyTargetAllowed(targetUrl))) {
    throw new ProxyTargetBlockedError(targetUrl);
  }

  const proxy = config?.SiteConfig.BangumiProxy?.trim();
  const fetchOptions: any = {
    headers,
    // 不自动跟随跳转：已校验的公网地址不能再被重定向到内网
    redirect: 'manual',
    signal: AbortSignal.timeout(proxy ? 30000 : 15000),
  };

  if (proxy) {
    fetchOptions.agent = new HttpsProxyAgent(proxy, {
      timeout: 30000,
      keepAlive: false,
    });
  }

  return nodeFetch(targetUrl, fetchOptions) as unknown as Promise<Response>;
}

// OrionTV 兼容接口
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const source = searchParams.get('source') || undefined;

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  try {
    const imageResponse = await fetchImage(imageUrl, { source });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: imageResponse.statusText },
        { status: imageResponse.status }
      );
    }

    // 只透传图片类型，防止上游返回 text/html 时以本站身份执行脚本
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

    // 设置缓存头（可选）
    headers.set('Cache-Control', 'public, max-age=15720000, s-maxage=15720000'); // 缓存半年
    headers.set('CDN-Cache-Control', 'public, s-maxage=15720000');
    headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=15720000');
    headers.set('Netlify-Vary', 'query');

    // 直接返回图片流
    return new Response(imageResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof ProxyTargetBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('图片代理请求失败:', error);
    return NextResponse.json(
      { error: 'Error fetching image' },
      { status: 500 }
    );
  }
}
