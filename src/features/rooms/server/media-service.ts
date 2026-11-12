import 'server-only';

import type { NextRequest } from 'next/server';

import { guardedFetch } from '@/lib/server/ssrf';

import {
  RoomMediaGateway,
  headersForOrigin,
} from '../../../../server/together/media-gateway.cjs';
import { synctv } from '../synctv/protocol/client';
import {
  assertRoomMediaOwner,
  assertRoomSourceAccess,
  resolveSiteRoomMedia,
  type RoomFilmReference,
} from './media-source';
import type { resolveTogetherPrincipal } from './principal';
import { getTogetherRuntime } from './runtime';

export type TogetherPrincipal = NonNullable<
  Awaited<ReturnType<typeof resolveTogetherPrincipal>>
>;
export type TogetherRuntime = NonNullable<
  ReturnType<typeof getTogetherRuntime>
>;
const memberships = new WeakMap<
  object,
  Map<string, { expiresAt: number; check: Promise<void> }>
>();
const registrations = new Map<string, Promise<void>>();

export function createRoomMediaGateway(
  service: TogetherRuntime,
  principal: TogetherPrincipal,
  request: NextRequest
) {
  const authorize = async (
    _actor: TogetherPrincipal,
    reference: RoomFilmReference
  ) => {
    await service.bridge.active(principal);
    await Promise.all([
      assertRoomMediaOwner(reference),
      assertRoomSourceAccess(principal.accountId, reference.source),
      assertRoomSourceAccess(reference.ownerAccountId, reference.source),
    ]);
    let cache = memberships.get(service);
    if (!cache) {
      cache = new Map();
      memberships.set(service, cache);
    }
    const key = JSON.stringify([
      principal.accountId,
      principal.sessionId,
      reference.roomId,
    ]);
    let entry = cache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      for (const [id, item] of cache)
        if (item.expiresAt <= Date.now()) cache.delete(id);
      const check = service.bridge
        .request(
          principal,
          'GET',
          '/api/user/rooms/' + reference.roomId + '/discovery',
          undefined
        )
        .then((result: { joined?: boolean }) => {
          if (result.joined !== true)
            throw Object.assign(new Error('Room membership required'), {
              status: 403,
              code: 'ROOM_MEMBERSHIP_REQUIRED',
            });
        });
      entry = { check, expiresAt: Date.now() + 2000 };
      cache.set(key, entry);
      void check.catch(() => {
        cache?.delete(key);
      });
    }
    await entry.check;
  };
  return new RoomMediaGateway({
    store: service.mediaStore,
    authorize,
    resolveSource: (reference: RoomFilmReference) =>
      resolveSiteRoomMedia(reference, principal.accountId, request),
    fetch: (
      url: string,
      init: RequestInit,
      policy: { trustedHosts: string[]; credentialOrigin: string }
    ) =>
      guardedFetch(
        url,
        {
          ...init,
          cache: 'no-store',
          signal: init.signal || request.signal,
        },
        {
          trustedHosts: new Set(policy.trustedHosts),
          headersForUrl: (target) =>
            headersForOrigin(init.headers, policy.credentialOrigin, target),
        }
      ),
  });
}

export async function registerRoomMedia(
  service: TogetherRuntime,
  principal: TogetherPrincipal,
  request: NextRequest,
  referenceId: string
) {
  const gateway = createRoomMediaGateway(service, principal, request);
  const descriptor = await gateway.describe(principal, referenceId);
  if (!registrations.has(referenceId)) {
    const registration = (async () => {
      const reference = service.mediaStore.require(referenceId);
      if (reference.upstreamMediaId) return;
      const origin = request.headers.get('origin');
      if (!origin)
        throw Object.assign(new Error('Origin required'), { status: 403 });
      const absolute = (value: string) => new URL(value, origin).href;
      const media = await service.bridge.request(
        principal,
        'POST',
        '/api/rooms/' + reference.roomId + '/media',
        {
          ...(reference.playlistId ? { playlistId: reference.playlistId } : {}),
          name: [descriptor.title, descriptor.episodeTitle]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 500),
          sourceConfig: {
            directUrl: {
              medias: [
                {
                  name: descriptor.episodeTitle,
                  url: absolute(descriptor.streamPath),
                  format:
                    descriptor.format === 'hls' ? 'm3u8' : descriptor.format,
                },
              ],
              subtitles: descriptor.subtitles.map(
                (item: {
                  label: string;
                  language: string;
                  format: string;
                  url: string;
                }) => ({
                  name: item.label,
                  language: item.language,
                  format: item.format,
                  url: absolute(item.url),
                })
              ),
              proxyMode:
                synctv.source_config.PlaybackProxyMode
                  .PLAYBACK_PROXY_MODE_DIRECT_ONLY,
            },
          },
        }
      );
      service.mediaStore.bindMedia(referenceId, media.id);
    })();
    registrations.set(referenceId, registration);
    void registration
      .finally(() => registrations.delete(referenceId))
      .catch(() => undefined);
  }
  await registrations.get(referenceId);
  return gateway.describe(principal, referenceId);
}

/** Keep media sound/data sessions revocable while streaming without buffering the movie. */
export function revocableMediaBody(
  body: ReadableStream<Uint8Array>,
  release: () => void,
  abort: AbortController
) {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          release();
          controller.close();
        } else controller.enqueue(result.value);
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      abort.abort();
      release();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}
