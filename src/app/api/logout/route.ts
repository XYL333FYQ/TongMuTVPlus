import { NextRequest, NextResponse } from 'next/server';

import { invalidateDeviceAccessToken } from '@/lib/access-token-invalidation';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { setAuthCookie } from '@/lib/auth-cookie';
import { isSecureRequest } from '@/lib/cookie-security';
import { getStorage } from '@/lib/db';
import { revokeRefreshToken } from '@/lib/refresh-token';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);

  // 撤销当前设备的 Refresh Token
  if (authInfo && authInfo.username && authInfo.tokenId) {
    try {
      invalidateDeviceAccessToken(authInfo.username, authInfo.tokenId);
      await revokeRefreshToken(authInfo.username, authInfo.tokenId);
      const storage = getStorage();
      await storage.deletePushSubscriptionsByTokenId?.(
        authInfo.username,
        authInfo.tokenId
      );
    } catch (error) {
      console.error('Failed to revoke refresh token:', error);
    }
  }

  const response = NextResponse.json({ ok: true });

  // 清除认证cookie
  setAuthCookie(response, '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    secure: isSecureRequest(request),
  });

  return response;
}
