/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({ getAuthInfoFromCookie: jest.fn() }));
jest.mock('@/lib/db', () => ({
  db: { getGlobalValue: jest.fn(), setGlobalValue: jest.fn() },
}));

import { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';

import { GET, POST } from './route';

const release = {
  version: '0.2.0',
  entries: [
    {
      version: '0.2.0',
      date: '2026-10-25',
      added: ['新功能'],
      changed: [],
      fixed: [],
    },
  ],
};
let stored: string | null;
let etag: string;
const request = (body: unknown, revision = etag, headers = {}) =>
  new NextRequest('https://tongmu.test/api/admin/releases', {
    method: 'POST',
    headers: { 'If-Match': revision, ...headers },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  jest.clearAllMocks();
  process.env.USERNAME = 'owner';
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'sqlite';
  stored = null;
  (getAuthInfoFromCookie as jest.Mock).mockReturnValue({ username: 'owner' });
  (db.getGlobalValue as jest.Mock).mockImplementation(async () => stored);
  (db.setGlobalValue as jest.Mock).mockImplementation(async (_key, value) => {
    stored = value;
  });
  etag =
    (
      await GET(new NextRequest('https://tongmu.test/api/admin/releases'))
    ).headers.get('ETag') || '';
});

test('owner saves release independently and reads it back without private config', async () => {
  const saved = await POST(
    request({ ...release, SiteConfig: { Secret: '不应写入' } })
  );
  expect(saved.status).toBe(200);
  const response = await GET(
    new NextRequest('https://tongmu.test/api/admin/releases')
  );
  expect(await response.json()).toEqual(release);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('ETag')).not.toBe(etag);
  expect(JSON.parse(stored || '{}')).toEqual(release);
});

test.each([null, { username: 'member' }, { username: 'admin' }])(
  'non-owner cannot read editor or publish: %p',
  async (auth) => {
    (getAuthInfoFromCookie as jest.Mock).mockReturnValue(auth);
    expect((await POST(request(release))).status).toBe(auth ? 403 : 401);
    expect(
      (await GET(new NextRequest('https://tongmu.test/api/admin/releases')))
        .status
    ).toBe(auth ? 403 : 401);
    expect(db.setGlobalValue).not.toHaveBeenCalled();
  }
);

test('invalid data does not overwrite persisted releases', async () => {
  expect((await POST(request({ ...release, entries: [] }))).status).toBe(400);
  expect(db.setGlobalValue).not.toHaveBeenCalled();
});

test('database failure is reported as failure', async () => {
  (db.setGlobalValue as jest.Mock).mockRejectedValue(new Error('offline'));
  expect((await POST(request(release))).status).toBe(500);
});

test('same-site publishing works behind a reverse proxy; foreign origins are rejected', async () => {
  const proxied = new NextRequest('http://localhost:3000/api/admin/releases', {
    method: 'POST',
    headers: {
      'If-Match': etag,
      origin: 'https://movies.example',
      'x-forwarded-host': 'movies.example',
      'x-forwarded-proto': 'https',
    },
    body: JSON.stringify(release),
  });
  expect((await POST(proxied)).status).toBe(200);
  (db.setGlobalValue as jest.Mock).mockClear();
  expect(
    (await POST(request(release, etag, { origin: 'https://foreign.example' })))
      .status
  ).toBe(403);
  expect(db.setGlobalValue).not.toHaveBeenCalled();
});

test('stale editor cannot overwrite history, including two simultaneous saves', async () => {
  const responses = await Promise.all([
    POST(request(release)),
    POST(request(release)),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 409,
  ]);
  expect(db.setGlobalValue).toHaveBeenCalledTimes(1);
  expect(JSON.parse(stored || '{}')).toEqual(release);
});

test('publishing requires a loaded baseline', async () => {
  expect((await POST(request(release, ''))).status).toBe(428);
  expect(db.setGlobalValue).not.toHaveBeenCalled();
});
