/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('server-only', () => ({}));
const mockPrincipal = jest.fn();
const mockDescribe = jest.fn();
const mockRequest = jest.fn();
const mockIssue = jest.fn();
let mockEnabled = true;
jest.mock('@/features/rooms/server/principal', () => ({
  resolveTogetherPrincipal: (...args: unknown[]) => mockPrincipal(...args),
}));
jest.mock('@/features/rooms/server/runtime', () => ({
  getTogetherRuntime: () =>
    mockEnabled
      ? {
          bridge: { describe: mockDescribe, request: mockRequest },
          tickets: { issue: mockIssue },
        }
      : null,
}));
import { NextRequest } from 'next/server';

import { GET } from './session/route';
import { POST } from './tickets/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockEnabled = true;
  mockPrincipal.mockResolvedValue({ accountId: 'alice', sessionId: 'device' });
  mockDescribe.mockResolvedValue({
    identityId: 'identity',
    upstreamUserId: 'user',
    displayName: 'alice',
  });
  mockRequest.mockResolvedValue({
    ticket: 'once',
    roomId: 'room_one',
    expiresInSecs: 30,
  });
});
test('session exposes only safe identity metadata and rejects anonymous or disabled requests', async () => {
  const request = new NextRequest('http://localhost/api/together/session');
  const response = await GET(request);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({
    identityId: 'identity',
    upstreamUserId: 'user',
    displayName: 'alice',
  });
  mockPrincipal.mockResolvedValue(null);
  expect((await GET(request)).status).toBe(401);
  expect(mockDescribe).toHaveBeenCalledTimes(1);
  mockEnabled = false;
  expect((await GET(request)).status).toBe(503);
});
function ticketRequest(
  origin = 'http://localhost',
  body: unknown = { roomId: 'room_one' }
) {
  return new NextRequest('http://localhost/api/together/tickets', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      cookie: 'auth=browser',
    },
    body: JSON.stringify(body),
  });
}
test('ticket creation checks same origin, auth and room before asking upstream', async () => {
  expect((await POST(ticketRequest('https://evil.test'))).status).toBe(403);
  expect(
    (await POST(ticketRequest('http://localhost', { roomId: '../admin' })))
      .status
  ).toBe(400);
  expect(mockRequest).not.toHaveBeenCalled();
  mockPrincipal.mockResolvedValue(null);
  expect((await POST(ticketRequest())).status).toBe(401);
  expect(mockRequest).not.toHaveBeenCalled();
});
test('ticket is bound to browser cookie and original actor before return', async () => {
  const response = await POST(ticketRequest());
  expect(response.status).toBe(200);
  expect(mockRequest).toHaveBeenCalledWith(
    { accountId: 'alice', sessionId: 'device' },
    'POST',
    '/api/tickets',
    { roomId: 'room_one' }
  );
  expect(mockIssue).toHaveBeenCalledWith(
    expect.objectContaining({
      ticket: 'once',
      roomId: 'room_one',
      accountId: 'alice',
      sessionId: 'device',
      cookie: 'auth=browser',
    })
  );
  expect(response.headers.get('cache-control')).toBe('no-store');
});

import {
  GET as roomGet,
  POST as roomPost,
  PUT as roomPut,
} from './[...operation]/route';
test('room route exposes explicit actor operations, blocks arbitrary APIs and checks origin', async () => {
  const context = (operation: string[]) => ({
    params: Promise.resolve({ operation }),
  });
  const create = () =>
    new NextRequest('http://localhost/api/together/rooms', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'test' }),
    });
  expect((await roomPost(create(), context(['admin', 'users']))).status).toBe(
    404
  );
  expect(mockRequest).not.toHaveBeenCalled();
  const response = await roomPost(create(), context(['rooms']));
  expect(response.status).toBe(200);
  expect(mockRequest).toHaveBeenLastCalledWith(
    { accountId: 'alice', sessionId: 'device' },
    'POST',
    '/api/rooms',
    { name: 'test' }
  );
  const join = new NextRequest(
    'http://localhost/api/together/rooms/room_one/membership',
    {
      method: 'PUT',
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
      },
      body: '{}',
    }
  );
  await roomPut(join, context(['rooms', 'room_one', 'membership']));
  expect(mockRequest).toHaveBeenLastCalledWith(
    { accountId: 'alice', sessionId: 'device' },
    'PUT',
    '/api/rooms/room_one/members/@me',
    { roomId: 'room_one' }
  );
  const list = new NextRequest(
    'http://localhost/api/together/rooms?page=2&pageSize=20'
  );
  await roomGet(list, context(['rooms']));
  expect(mockRequest).toHaveBeenLastCalledWith(
    { accountId: 'alice', sessionId: 'device' },
    'GET',
    '/api/user/rooms?page=2&pageSize=20',
    undefined
  );
});

test('bridge revocation and upstream throttling retain actionable status without leaking errors', async () => {
  const request = new NextRequest('http://localhost/api/together/session');
  mockDescribe.mockRejectedValueOnce(
    Object.assign(new Error('private-password'), { status: 401 })
  );
  expect((await GET(request)).status).toBe(401);
  mockDescribe.mockRejectedValueOnce(
    Object.assign(new Error('private-password'), {
      status: 429,
      retryAfterMs: 11000,
    })
  );
  const limited = await GET(request);
  expect(limited.status).toBe(429);
  expect(limited.headers.get('retry-after')).toBe('11');
  expect(JSON.stringify(await limited.json())).not.toContain(
    'private-password'
  );
});

import { DELETE as roomDelete } from './[...operation]/route';
test('an empty DELETE body is accepted even when the server exposes it as a readable stream', async () => {
  const request = new NextRequest(
    'http://localhost/api/together/rooms/room_one',
    { method: 'DELETE', headers: { origin: 'http://localhost' }, body: '' }
  );
  const result = await roomDelete(request, {
    params: Promise.resolve({ operation: ['rooms', 'room_one'] }),
  });
  expect(result.status).toBe(200);
  expect(mockRequest).toHaveBeenLastCalledWith(
    { accountId: 'alice', sessionId: 'device' },
    'DELETE',
    '/api/rooms/room_one',
    undefined
  );
});
