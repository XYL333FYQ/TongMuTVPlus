import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function mediaError(failure: unknown) {
  const status = (failure as { status?: number })?.status;
  const safe =
    status &&
    [400, 401, 403, 404, 409, 410, 413, 415, 416, 429, 501, 503].includes(
      status
    )
      ? status
      : 502;
  return NextResponse.json(
    {
      code:
        safe === 401
          ? 'UNAUTHORIZED'
          : safe === 403
          ? 'FORBIDDEN'
          : 'MEDIA_REQUEST_FAILED',
    },
    {
      status: safe,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

export async function readMediaInput(request: NextRequest) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw { status: 415 };
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400 };
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) {
      await reader.cancel();
      throw { status: 413 };
    }
    chunks.push(value);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw { status: 400 };
  }
  const text = (value: unknown, max: number) =>
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    !Array.from(value).some((character) => character.charCodeAt(0) < 32);
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) =>
        ![
          'source',
          'filmId',
          'episodeIndex',
          'kind',
          'requestId',
          'playlistId',
        ].includes(key)
    ) ||
    !text(body.source, 2048) ||
    !text(body.filmId, 2048) ||
    !text(body.requestId, 128) ||
    !Number.isSafeInteger(body.episodeIndex) ||
    body.episodeIndex < 0 ||
    !['movie', 'music', 'live', 'screen'].includes(body.kind) ||
    (body.playlistId !== undefined &&
      !/^pl_[A-Za-z0-9]{1,61}$/.test(body.playlistId))
  )
    throw { status: 400 };
  return {
    source: body.source as string,
    filmId: body.filmId as string,
    episodeIndex: body.episodeIndex as number,
    kind: body.kind as string,
    requestId: body.requestId as string,
    ...(body.playlistId !== undefined
      ? { playlistId: body.playlistId as string }
      : {}),
  };
}
