import { NextRequest, NextResponse } from 'next/server';

import { setAuthCookie } from '@/lib/auth-cookie';
import { isSecureRequest } from '@/lib/cookie-security';
import { getQrLoginSession, saveQrLoginSession } from '@/lib/qr-login/store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const session = await getQrLoginSession(token);
  if (!session) return NextResponse.json({ status: 'expired' });

  if (session.status === 'confirmed' && session.authToken) {
    session.status = 'used';
    await saveQrLoginSession(session);
    const response = NextResponse.json({ status: 'confirmed' });
    const expires = new Date();
    expires.setDate(expires.getDate() + 60);
    setAuthCookie(response, session.authToken, {
      path: '/',
      expires,
      sameSite: 'lax',
      secure: isSecureRequest(request),
    });
    return response;
  }

  return NextResponse.json({
    status: session.status,
    expiresAt: session.expiresAt,
  });
}
