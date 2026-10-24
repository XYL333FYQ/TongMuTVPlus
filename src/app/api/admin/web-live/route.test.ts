/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'owner' }),
}));
jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/lib/db', () => ({ db: { saveAdminConfig: jest.fn() } }));

import { NextRequest } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

import { POST } from './route';

const source = (key: string) => ({ key, name: key, platform: 'huya' });

test('sorting with a stale list keeps sources that were not in the list', async () => {
  process.env.USERNAME = 'owner';
  const config = {
    WebLiveConfig: [source('a'), source('b'), source('c')],
  };
  (getConfig as jest.Mock).mockResolvedValue(config);

  const response = await POST(
    new NextRequest('https://tongmu.test/api/admin/web-live', {
      method: 'POST',
      body: JSON.stringify({ action: 'sort', keys: ['b', 'a'] }),
    })
  );

  expect(response.status).toBe(200);
  const saved = (db.saveAdminConfig as jest.Mock).mock.calls[0][0];
  expect(saved.WebLiveConfig.map((s: { key: string }) => s.key)).toEqual([
    'b',
    'a',
    'c',
  ]);
});
