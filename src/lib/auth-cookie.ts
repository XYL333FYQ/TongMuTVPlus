/* eslint-disable @typescript-eslint/no-explicit-any */

import type { NextResponse } from 'next/server';

import { getAuthSigningSecret } from '@/lib/auth-secret';

import { parseAuthInfo } from './auth';
import {
  generateRefreshToken,
  generateTokenId,
  storeRefreshToken,
  TOKEN_CONFIG,
} from './refresh-token';

const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'upstash'
    | 'kvrocks'
    | 'd1'
    | 'postgres'
    | undefined) || 'localstorage';

export async function generateAuthSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getDeviceInfoFromUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('moontvplus')) return 'MoonTVPlus APP';
  if (ua.includes('oriontv')) return 'OrionTV';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ios')) return 'iOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';

  return 'Unknown Device';
}

export async function generateAuthCookieValue(input: {
  username?: string;
  password?: string;
  role?: 'owner' | 'admin' | 'user';
  includePassword?: boolean;
  deviceInfo?: string;
}): Promise<string> {
  const now = Date.now();
  const authData: any = { role: input.role || 'user' };

  if (input.includePassword && input.password) {
    authData.password = input.password;
  }

  if (input.username && process.env.PASSWORD) {
    authData.username = input.username;
    authData.timestamp = now;

    if (!input.includePassword && STORAGE_TYPE !== 'localstorage') {
      const tokenId = generateTokenId();
      const refreshToken = generateRefreshToken();
      const refreshExpires = now + TOKEN_CONFIG.REFRESH_TOKEN_AGE;

      authData.tokenId = tokenId;
      authData.refreshToken = refreshToken;
      authData.refreshExpires = refreshExpires;

      await storeRefreshToken(input.username, tokenId, {
        token: refreshToken,
        deviceInfo: input.deviceInfo || 'Unknown Device',
        createdAt: now,
        expiresAt: refreshExpires,
        lastUsed: now,
      });
    }

    const dataToSign = JSON.stringify({
      username: authData.username,
      role: authData.role,
      timestamp: authData.timestamp,
    });
    authData.signature = await generateAuthSignature(
      dataToSign,
      getAuthSigningSecret()
    );
  }

  return encodeURIComponent(JSON.stringify(authData));
}

// 登录凭证 Cookie 的统一写法（服务端用）。
//
// 以前登录凭证 `auth` 是网页脚本能读到的（httpOnly: false），因为前端要显示用户名、
// 判断角色、计算何时续期。可凭证里还有签名、续期令牌（本地模式下甚至有密码），
// 一旦哪天出现脚本注入，就能被整串偷走。现在拆成两个：
//   - `auth`：真正的凭证，脚本读不到（httpOnly）。名字、内容、有效期都不变，
//     服务端、房间服务、各客户端照旧读它。
//   - `auth_info`：只放显示用的字段（用户名、角色、签发时间、续期截止），脚本可读。
//     服务端从不信任它，伪造它最多让自己的界面显示错，拿不到任何权限。

export const AUTH_COOKIE = 'auth';
export const AUTH_DISPLAY_COOKIE = 'auth_info';

type AuthCookieOptions = {
  path?: string;
  expires: Date;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
};

/** 从完整凭证里挑出前端需要显示的字段；解析不了就返回空串 */
export function authDisplayValue(value: string): string {
  const info = parseAuthInfo(value);
  if (!info) return '';
  return JSON.stringify({
    username: info.username,
    role: info.role,
    timestamp: info.timestamp,
    refreshExpires: info.refreshExpires,
  });
}

/** 写入（或用空值 + 过去的时间清除）登录凭证与显示信息两个 Cookie */
export function setAuthCookie(
  response: NextResponse,
  value: string,
  options: AuthCookieOptions
): void {
  const base = { path: '/', sameSite: 'lax' as const, ...options };
  response.cookies.set(AUTH_COOKIE, value, { ...base, httpOnly: true });
  response.cookies.set(
    AUTH_DISPLAY_COOKIE,
    value ? authDisplayValue(value) : '',
    { ...base, httpOnly: false }
  );
}
