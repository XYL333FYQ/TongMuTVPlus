import { NextRequest, NextResponse } from 'next/server';

import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  const service = getTogetherRuntime();
  if (!service)
    return NextResponse.json(
      { code: 'TOGETHER_DISABLED' },
      { status: 503, headers }
    );
  const principal = await resolveTogetherPrincipal(request);
  if (!principal)
    return NextResponse.json(
      { code: 'UNAUTHORIZED' },
      { status: 401, headers }
    );
  try {
    return NextResponse.json(await service.bridge.describe(principal), {
      headers,
    });
  } catch (failure) {
    const error = failure as { status?: number; retryAfterMs?: number };
    const status = [401, 403, 429].includes(error.status || 0)
      ? error.status
      : 502;
    if (status === 429)
      headers['Retry-After'] = String(
        Math.max(1, Math.ceil((error.retryAfterMs || 1000) / 1000))
      );
    return NextResponse.json(
      {
        code:
          status === 401
            ? 'UNAUTHORIZED'
            : status === 429
            ? 'TOGETHER_RATE_LIMITED'
            : 'TOGETHER_UNAVAILABLE',
      },
      { status, headers }
    );
  }
}
