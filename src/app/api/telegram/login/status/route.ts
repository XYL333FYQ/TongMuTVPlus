import { NextRequest, NextResponse } from 'next/server';

import { setAuthCookie } from '@/lib/auth-cookie';
import { isSecureRequest } from '@/lib/cookie-security';
import {
  consumeConfirmedTelegramLogin,
  getTelegramLoginSession,
} from '@/lib/telegram';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  const session = await getTelegramLoginSession(token);
  if (!session) return NextResponse.json({ status: 'expired' });

  if (session.status === 'confirmed' && session.authToken) {
    const consumed = await consumeConfirmedTelegramLogin(session.token);
    const response = NextResponse.json({
      status: 'confirmed',
      username: consumed?.username,
    });
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
