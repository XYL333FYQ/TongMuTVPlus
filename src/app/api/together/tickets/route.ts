import { NextRequest, NextResponse } from 'next/server';

import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { isTogetherSameOrigin } from '@/features/rooms/server/request-origin';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

import { validRoom } from '../../../../../server/together/tickets.cjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  const error = (code: string, status: number) =>
    NextResponse.json({ code }, { status, headers });
  if (!isTogetherSameOrigin(request)) return error('FORBIDDEN_ORIGIN', 403);
  const service = getTogetherRuntime();
  if (!service) return error('TOGETHER_DISABLED', 503);
  const principal = await resolveTogetherPrincipal(request);
  if (!principal) return error('UNAUTHORIZED', 401);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return error('INVALID_CONTENT_TYPE', 415);
  // Ticket requests contain only a room ID. Cap actual bytes, including chunked bodies.
  const reader = request.body?.getReader();
  if (!reader) return error('INVALID_BODY', 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2048) {
        await reader.cancel();
        return error('BODY_TOO_LARGE', 413);
      }
      chunks.push(value);
    }
  } catch {
    return error('INVALID_BODY', 400);
  }
  let body: { roomId?: unknown };
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return error('INVALID_BODY', 400);
  }
  if (!body || !validRoom(body.roomId)) return error('INVALID_ROOM', 400);
  const roomId = body.roomId as string;
  const cookie = request.headers.get('cookie') || '';
  if (!cookie) return error('UNAUTHORIZED', 401);
  try {
    const ticket = await service.bridge.request(
      principal,
      'POST',
      '/api/tickets',
      { roomId }
    );
    if (ticket.roomId !== roomId) return error('INVALID_UPSTREAM_TICKET', 502);
    service.tickets.issue({
      ...ticket,
      principal,
      roomId,
      cookie,
      accountId: principal.accountId,
      sessionId: principal.sessionId,
    });
    return NextResponse.json(
      {
        ticket: ticket.ticket,
        roomId,
        expiresInSecs: Math.min(30, ticket.expiresInSecs),
      },
      { headers }
    );
  } catch (failure) {
    const status = (failure as { status?: number })?.status;
    return error(
      status === 401
        ? 'UNAUTHORIZED'
        : status === 403
        ? 'FORBIDDEN'
        : 'TOGETHER_UNAVAILABLE',
      status === 401 || status === 403 || status === 429 ? status : 502
    );
  }
}
