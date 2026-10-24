import type { NextRequest } from 'next/server';

import { isAccessTokenInvalidated } from '@/lib/access-token-invalidation';
import { type AuthInfo, getAuthInfoFromCookie } from '@/lib/auth';
import { getAuthSigningSecret } from '@/lib/auth-secret';
import { TOKEN_CONFIG } from '@/lib/token-config';

/** Edge-compatible authentication. Parsing a cookie is never sufficient authorization. */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthInfo | null> {
  return authenticateAuthInfo(getAuthInfoFromCookie(request));
}

/** Shared signature verification for route requests and server-rendered layouts. */
export async function authenticateAuthInfo(
  auth: AuthInfo | null
): Promise<AuthInfo | null> {
  const password = process.env.PASSWORD;
  if (!password) return null;
  if (!auth || isAccessTokenInvalidated(auth)) return null;
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  ) {
    // 本地存储模式没有签名，Cookie 里直接是访问密码
    return auth.password === password ? auth : null;
  }
  const secret = getAuthSigningSecret();
  const now = Date.now();
  if (
    !auth.username ||
    !['owner', 'admin', 'user'].includes(auth.role || '') ||
    typeof auth.timestamp !== 'number' ||
    !Number.isFinite(auth.timestamp) ||
    auth.timestamp > now + 30000 ||
    now - auth.timestamp > TOKEN_CONFIG.ACCESS_TOKEN_AGE ||
    typeof auth.refreshExpires !== 'number' ||
    !Number.isFinite(auth.refreshExpires) ||
    auth.refreshExpires <= now ||
    !auth.tokenId ||
    !auth.refreshToken ||
    typeof auth.signature !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(auth.signature)
  )
    return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signature = Uint8Array.from(
      auth.signature.match(/.{2}/g) || [],
      (byte) => parseInt(byte, 16)
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(
        JSON.stringify({
          username: auth.username,
          role: auth.role,
          timestamp: auth.timestamp,
        })
      )
    );
    return valid ? auth : null;
  } catch {
    return null;
  }
}
