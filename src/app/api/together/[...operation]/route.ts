import { NextRequest, NextResponse } from 'next/server';

import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { isTogetherSameOrigin } from '@/features/rooms/server/request-origin';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

import { resolveTogetherOperation } from '../../../../../server/together/http-policy.cjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ operation: string[] }> };

async function handle(request: NextRequest, context: Context) {
  const headers = { 'Cache-Control': 'no-store' };
  const error = (code: string, status: number) =>
    NextResponse.json({ code }, { status, headers });
  const write = request.method !== 'GET';
  if (write && !isTogetherSameOrigin(request))
    return error('FORBIDDEN_ORIGIN', 403);
  const { operation } = await context.params;
  let target;
  try {
    target = resolveTogetherOperation(
      request.method,
      operation,
      request.nextUrl.searchParams
    );
  } catch {
    return error('INVALID_QUERY', 400);
  }
  if (!target) return error('NOT_FOUND', 404);
  const service = getTogetherRuntime();
  if (!service) return error('TOGETHER_DISABLED', 503);
  const principal = await resolveTogetherPrincipal(request);
  if (!principal) return error('UNAUTHORIZED', 401);
  let body: Record<string, unknown> | undefined;
  if (write) {
    const reader = request.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 65536) {
            await reader.cancel();
            return error('BODY_TOO_LARGE', 413);
          }
          chunks.push(value);
        }
        if (length) {
          if (
            !request.headers.get('content-type')?.startsWith('application/json')
          )
            return error('INVALID_CONTENT_TYPE', 415);
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!body || typeof body !== 'object' || Array.isArray(body))
            return error('INVALID_BODY', 400);
        }
      } catch {
        return error('INVALID_BODY', 400);
      }
    }
    if (body && typeof body.password === 'string' && body.password)
      return error('USE_OPAQUE_PASSWORD_FLOW', 400);
    if (target.roomId && body?.roomId && body.roomId !== target.roomId)
      return error('INVALID_ROOM', 400);
    if (
      (operation[2] === 'membership' && request.method === 'PUT') ||
      operation.slice(2).join('/') === 'password/opaque/login/start'
    )
      body = { ...body, roomId: target.roomId };
  }
  try {
    const result = await service.bridge.request(
      principal,
      request.method,
      target.path,
      body
    );
    return NextResponse.json(result, { headers });
  } catch (failure) {
    const status = (failure as { status?: number })?.status;
    const allowed = [400, 401, 403, 404, 409, 422, 429];
    return error(
      status === 401
        ? 'UNAUTHORIZED'
        : status === 403
        ? 'FORBIDDEN'
        : 'TOGETHER_REQUEST_FAILED',
      status && allowed.includes(status) ? status : 502
    );
  }
}
export {
  handle as DELETE,
  handle as GET,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
