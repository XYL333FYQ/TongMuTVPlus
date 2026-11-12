import type { NextRequest } from 'next/server';

import { isSecureRequest } from '@/lib/cookie-security';

/** Next's custom server can normalize request.url to localhost; Host stays public. */
export function isTogetherSameOrigin(request: NextRequest): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = request.headers.get('host') || request.nextUrl.host;
    const protocol = isSecureRequest(request) ? 'https:' : 'http:';
    return (
      parsed.origin === origin &&
      parsed.host === host &&
      parsed.protocol === protocol
    );
  } catch {
    return false;
  }
}
