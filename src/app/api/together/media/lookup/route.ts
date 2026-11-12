import { NextRequest, NextResponse } from 'next/server';
import { mediaError } from '@/features/rooms/server/media-http';
import { createRoomMediaGateway } from '@/features/rooms/server/media-service';
import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const service = getTogetherRuntime();
    if (!service) throw { status: 503 };
    const principal = await resolveTogetherPrincipal(request);
    if (!principal) throw { status: 401 };
    const roomId = request.nextUrl.searchParams.get('roomId') || '',
      mediaId = request.nextUrl.searchParams.get('mediaId') || '';
    if (
      !/^room_[A-Za-z0-9]{1,59}$/.test(roomId) ||
      !/^med_[A-Za-z0-9]{1,60}$/.test(mediaId)
    )
      throw { status: 400 };
    const reference = service.mediaStore.getByMediaId(roomId, mediaId);
    if (!reference) throw { status: 404 };
    const descriptor = await createRoomMediaGateway(
      service,
      principal,
      request
    ).describe(principal, reference.id);
    return NextResponse.json(descriptor, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return mediaError(error);
  }
}
