/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('server-only', () => ({}));
const mockPrincipal = jest.fn();
const mockCreate = jest.fn();
const mockRegister = jest.fn();
const mockOpen = jest.fn();
const mockDescriptor = jest.fn();
const mockLookup = jest.fn();
const mockRelease = jest.fn();
const mockTrack = jest.fn((..._args: unknown[]) => mockRelease);
jest.mock('@/features/rooms/server/principal', () => ({
  resolveTogetherPrincipal: () => mockPrincipal(),
}));
jest.mock('@/features/rooms/server/runtime', () => ({
  getTogetherRuntime: () => ({
    bridge: { describe: async () => ({ identityId: 'identity_alice' }) },
    mediaStore: {
      create: (...args: unknown[]) => mockCreate(...args),
      getByMediaId: (...args: unknown[]) => mockLookup(...args),
    },
    track: (...args: unknown[]) => mockTrack(...args),
  }),
}));
jest.mock('@/features/rooms/server/media-service', () => ({
  registerRoomMedia: (...args: unknown[]) => mockRegister(...args),
  createRoomMediaGateway: () => ({
    open: (...args: unknown[]) => mockOpen(...args),
    describe: (...args: unknown[]) => mockDescriptor(...args),
  }),
  revocableMediaBody: (body: unknown) => body,
}));
import { NextRequest } from 'next/server';
import { POST } from './rooms/[roomId]/media/route';
import { GET, HEAD } from './media/[referenceId]/[...resource]/route';
import { GET as INFO, POST as REFRESH } from './media/[referenceId]/route';
import { GET as LOOKUP } from './media/lookup/route';
const context = { params: Promise.resolve({ roomId: 'room_test' }) };
test('upstream media lookup stays bound to the room and invokes authorized descriptor resolution', async () => {
  mockLookup.mockReturnValue({ id: 'ref' });
  const response = await LOOKUP(
    new NextRequest(
      'http://localhost/api/together/media/lookup?roomId=room_one&mediaId=med_one'
    )
  );
  expect(response.status).toBe(200);
  expect(mockLookup).toHaveBeenCalledWith('room_one', 'med_one');
  expect(mockDescriptor).toHaveBeenCalledWith(expect.anything(), 'ref');
  mockLookup.mockReturnValue(null);
  expect(
    (
      await LOOKUP(
        new NextRequest(
          'http://localhost/api/together/media/lookup?roomId=room_other&mediaId=med_one'
        )
      )
    ).status
  ).toBe(404);
});
const streamContext = {
  params: Promise.resolve({
    referenceId: 'tmmedia_' + 'a'.repeat(32),
    resource: ['stream.mp4'],
  }),
};
const body = {
  source: 'cms',
  filmId: 'film',
  episodeIndex: 2,
  kind: 'movie',
  requestId: 'once',
};
const post = (value: unknown, origin = 'http://localhost') =>
  new NextRequest('http://localhost/api/together/rooms/room_test/media', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  jest.clearAllMocks();
  mockPrincipal.mockResolvedValue({ accountId: 'alice', sessionId: 'device' });
  mockCreate.mockReturnValue({ id: 'ref' });
  mockRegister.mockResolvedValue({ id: 'ref', streamPath: '/safe' });
  mockDescriptor.mockResolvedValue({ id: 'ref', streamPath: '/safe' });
  mockOpen.mockResolvedValue(
    new Response(null, {
      status: 206,
      headers: { 'content-range': 'bytes 0-1/20' },
    })
  );
});
test('selected immutable episode is created under the authenticated identity without a play command', async () => {
  expect((await POST(post(body), context)).status).toBe(200);
  expect(mockCreate).toHaveBeenCalledWith({
    ...body,
    roomId: 'room_test',
    ownerIdentityId: 'identity_alice',
  });
  expect(mockRegister).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.anything(),
    'ref'
  );
});
test('rejects external origin, raw URLs, invalid episodes and anonymous requests before creating media', async () => {
  expect((await POST(post(body, 'https://evil.test'), context)).status).toBe(
    403
  );
  for (const value of [
    { ...body, url: 'https://secret.test' },
    { ...body, episodeIndex: -1 },
    { ...body, kind: 'unknown' },
  ]) {
    expect((await POST(post(value), context)).status).toBe(400);
  }
  mockPrincipal.mockResolvedValue(null);
  expect((await POST(post(body), context)).status).toBe(401);
  expect(mockCreate).not.toHaveBeenCalled();
});
test('stream and HEAD preserve Range and release finished tracking; anonymous requests never resolve media', async () => {
  const request = new NextRequest(
    'http://localhost/api/together/media/ref/stream.mp4',
    { headers: { range: 'bytes=0-1' } }
  );
  const response = await GET(request, streamContext);
  expect(response.status).toBe(206);
  expect(response.headers.get('content-range')).toBe('bytes 0-1/20');
  expect(mockOpen.mock.calls[0][3].headers.get('range')).toBe('bytes=0-1');
  expect(mockRelease).toHaveBeenCalledTimes(1);
  await HEAD(request, streamContext);
  expect(mockOpen.mock.calls[1][3].method).toBe('HEAD');
  mockPrincipal.mockResolvedValue(null);
  expect((await GET(request, streamContext)).status).toBe(401);
  expect(mockOpen).toHaveBeenCalledTimes(2);
});
test('stream failures release tracking and hide provider errors', async () => {
  mockOpen.mockRejectedValue(
    Object.assign(new Error('secret upstream URL'), { status: 403 })
  );
  const response = await GET(
    new NextRequest('http://localhost/api/together/media/ref/stream.mp4'),
    streamContext
  );
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain('secret');
  expect(mockRelease).toHaveBeenCalledTimes(1);
});
test('descriptor refresh requires same origin and keeps the immutable reference', async () => {
  const context = {
    params: Promise.resolve({ referenceId: 'tmmedia_' + 'a'.repeat(32) }),
  };
  expect(
    (await INFO(new NextRequest('http://localhost'), context)).status
  ).toBe(200);
  expect(
    (
      await REFRESH(
        new NextRequest('http://localhost', {
          method: 'POST',
          headers: { origin: 'https://evil.test' },
        }),
        context
      )
    ).status
  ).toBe(403);
  expect(
    (
      await REFRESH(
        new NextRequest('http://localhost', {
          method: 'POST',
          headers: { origin: 'http://localhost' },
        }),
        context
      )
    ).status
  ).toBe(200);
  expect(mockDescriptor.mock.calls[1][1]).toBe('tmmedia_' + 'a'.repeat(32));
  expect(mockDescriptor.mock.calls[1][2]).toEqual({ force: true });
});
