import { NextRequest } from 'next/server';
import { mediaError } from '@/features/rooms/server/media-http';
import {
  createRoomMediaGateway,
  revocableMediaBody,
} from '@/features/rooms/server/media-service';
import { resolveTogetherPrincipal } from '@/features/rooms/server/principal';
import { getTogetherRuntime } from '@/features/rooms/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ referenceId: string; resource: string[] }> };
async function handle(
  request: NextRequest,
  context: Context,
  method: 'GET' | 'HEAD'
) {
  let release: (() => void) | undefined;
  const abort = new AbortController();
  try {
    const service = getTogetherRuntime();
    if (!service) throw { status: 503 };
    const principal = await resolveTogetherPrincipal(request);
    if (!principal) throw { status: 401 };
    const { referenceId, resource } = await context.params;
    const raw = resource.join('/');
    if (
      !/^tmmedia_[a-f0-9]{32}$/.test(referenceId) ||
      !/^(stream\.(mp4|m3u8|audio)|poster|subtitle\/\d{1,3}|resource\/tmres_[a-f0-9]{32})$/.test(
        raw
      )
    )
      throw { status: 404 };
    const target = raw.startsWith('stream.') ? 'stream' : raw;
    const cleanup: () => void = service.track(principal, () => abort.abort());
    release = cleanup;
    const gateway = createRoomMediaGateway(service, principal, request);
    const response = await gateway.open(principal, referenceId, target, {
      method,
      headers: request.headers,
      signal: AbortSignal.any([request.signal, abort.signal]),
    });
    if (!response.body || method === 'HEAD') {
      cleanup();
      release = undefined;
      return response;
    }
    release = undefined;
    return new Response(revocableMediaBody(response.body, cleanup, abort), {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    abort.abort();
    release?.();
    return mediaError(error);
  }
}
export const GET = (request: NextRequest, context: Context) =>
  handle(request, context, 'GET');
export const HEAD = (request: NextRequest, context: Context) =>
  handle(request, context, 'HEAD');
