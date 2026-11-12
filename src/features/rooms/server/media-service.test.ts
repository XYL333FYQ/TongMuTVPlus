/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('server-only', () => ({}));
const mockAuthorizeOwner = jest.fn();
const mockAccess = jest.fn();
const mockDescribe = jest.fn();
const mockFetch = jest.fn();
let mockOptions: {
  authorize: (actor: unknown, reference: unknown) => Promise<void>;
  fetch: (url: string, init: RequestInit, policy: unknown) => Promise<Response>;
};
jest.mock('../../../../server/together/media-gateway.cjs', () => ({
  RoomMediaGateway: class {
    constructor(options: typeof mockOptions) {
      mockOptions = options;
    }
    describe = mockDescribe;
  },
  headersForOrigin: jest.fn(),
}));
jest.mock('./media-source', () => ({
  assertRoomMediaOwner: (...args: unknown[]) => mockAuthorizeOwner(...args),
  assertRoomSourceAccess: (...args: unknown[]) => mockAccess(...args),
  resolveSiteRoomMedia: jest.fn(),
}));
jest.mock('@/lib/server/ssrf', () => ({
  guardedFetch: (...args: unknown[]) => mockFetch(...args),
}));
import { NextRequest } from 'next/server';
import {
  createRoomMediaGateway,
  registerRoomMedia,
  revocableMediaBody,
} from './media-service';
const principal = { accountId: 'alice', sessionId: 'device' };
const reference = {
  id: 'ref',
  roomId: 'room_one',
  ownerAccountId: 'owner',
  source: 'cms',
  upstreamMediaId: null,
};
const createService = () => ({
  bridge: {
    active: jest.fn(),
    request: jest.fn().mockResolvedValue({ id: 'med_one', joined: true }),
  },
  mediaStore: { require: () => reference, bindMedia: jest.fn() },
});
beforeEach(() => {
  jest.clearAllMocks();
  mockDescribe.mockResolvedValue({
    title: 'Film',
    episodeTitle: 'Episode 3',
    format: 'hls',
    streamPath: '/api/together/media/ref/stream.m3u8',
    subtitles: [],
  });
});
test('registration sends only same-origin gateway URLs to the ordinary identity and never starts playback', async () => {
  const service = createService();
  await registerRoomMedia(
    service as never,
    principal as never,
    new NextRequest('http://localhost', {
      headers: { origin: 'http://localhost' },
    }),
    'ref'
  );
  expect(service.bridge.request).toHaveBeenCalledTimes(1);
  expect(service.bridge.request).toHaveBeenCalledWith(
    principal,
    'POST',
    '/api/rooms/room_one/media',
    expect.objectContaining({
      sourceConfig: {
        directUrl: expect.objectContaining({
          medias: [
            expect.objectContaining({
              url: 'http://localhost/api/together/media/ref/stream.m3u8',
            }),
          ],
        }),
      },
    })
  );
  expect(service.mediaStore.bindMedia).toHaveBeenCalledWith('ref', 'med_one');
});
test('media authorization checks current account, both source grants and real joined membership', async () => {
  const service = createService();
  createRoomMediaGateway(
    service as never,
    principal as never,
    new NextRequest('http://localhost')
  );
  await mockOptions.authorize(principal, reference);
  expect(mockAccess.mock.calls).toEqual([
    ['alice', 'cms'],
    ['owner', 'cms'],
  ]);
  expect(service.bridge.request).toHaveBeenCalledWith(
    principal,
    'GET',
    '/api/user/rooms/room_one/discovery',
    undefined
  );
  const outsider = createService();
  outsider.bridge.request.mockResolvedValue({ joined: false } as never);
  createRoomMediaGateway(
    outsider as never,
    principal as never,
    new NextRequest('http://localhost')
  );
  await expect(
    mockOptions.authorize(principal, reference)
  ).rejects.toMatchObject({ status: 403 });
});
test('stream tracking is released when consumption ends or is cancelled', async () => {
  const release = jest.fn();
  const abort = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  expect(
    await new Response(revocableMediaBody(body, release, abort)).arrayBuffer()
  ).toHaveProperty('byteLength', 1);
  expect(release).toHaveBeenCalledTimes(1);
  const release2 = jest.fn();
  const abort2 = new AbortController();
  await revocableMediaBody(new ReadableStream(), release2, abort2).cancel();
  expect(abort2.signal.aborted).toBe(true);
  expect(release2).toHaveBeenCalledTimes(1);
});
test('a long movie stream follows request cancellation without a 15-second whole-body deadline', async () => {
  const request = new NextRequest('http://localhost');
  createRoomMediaGateway(createService() as never, principal as never, request);
  await mockOptions.fetch(
    'https://media.test/film.mp4',
    { signal: request.signal },
    { trustedHosts: [], credentialOrigin: 'https://media.test' }
  );
  expect(mockFetch.mock.calls[0][1].signal).toBe(request.signal);
});
