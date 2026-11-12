import { NextRequest, NextResponse } from 'next/server';
import { readMediaInput, mediaError } from '@/features/rooms/server/media-http';
import { registerRoomMedia } from '@/features/rooms/server/media-service';
import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { isTogetherSameOrigin } from '@/features/rooms/server/request-origin';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    if (!isTogetherSameOrigin(request)) throw { status: 403 };
    const service = getTogetherRuntime();
    if (!service) throw { status: 503 };
    const principal = await resolveTogetherPrincipal(request);
    if (!principal) throw { status: 401 };
    const { roomId } = await context.params;
    if (!/^room_[A-Za-z0-9]{1,59}$/.test(roomId)) throw { status: 400 };
    const input = await readMediaInput(request);
    const { identityId } = await service.bridge.describe(principal);
    const reference = service.mediaStore.create({
      ...input,
      roomId,
      ownerIdentityId: identityId,
    });
    const result = await registerRoomMedia(
      service,
      principal,
      request,
      reference.id
    );
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return mediaError(error);
  }
}
