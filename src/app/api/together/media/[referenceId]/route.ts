import { NextRequest, NextResponse } from 'next/server';
import { mediaError } from '@/features/rooms/server/media-http';
import { createRoomMediaGateway } from '@/features/rooms/server/media-service';
import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { isTogetherSameOrigin } from '@/features/rooms/server/request-origin';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ referenceId: string }> };
async function handle(request: NextRequest, context: Context, force: boolean) {
  try {
    if (force && !isTogetherSameOrigin(request)) throw { status: 403 };
    const service = getTogetherRuntime();
    if (!service) throw { status: 503 };
    const principal = await resolveTogetherPrincipal(request);
    if (!principal) throw { status: 401 };
    const { referenceId } = await context.params;
    if (!/^tmmedia_[a-f0-9]{32}$/.test(referenceId)) throw { status: 404 };
    const descriptor = await createRoomMediaGateway(
      service,
      principal,
      request
    ).describe(principal, referenceId, { force });
    return NextResponse.json(descriptor, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return mediaError(error);
  }
}
export const GET = (request: NextRequest, context: Context) =>
  handle(request, context, false);
export const POST = (request: NextRequest, context: Context) =>
  handle(request, context, true);
