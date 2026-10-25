/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: jest.fn(() => ({ username: 'owner' })),
}));
jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/lib/db', () => ({
  db: { saveAdminConfig: jest.fn(), getUserInfoV2: jest.fn() },
}));

import { NextRequest } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

import { POST } from './route';

const source = (key: string) => ({ key, name: key, platform: 'huya' });

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('https://tongmu.test/api/admin/web-live', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  process.env.USERNAME = 'owner';
  (getAuthInfoFromCookie as jest.Mock).mockReturnValue({ username: 'owner' });
  (db.saveAdminConfig as jest.Mock).mockReset();
});

test('sorting with a stale list keeps sources that were not in the list', async () => {
  const config = {
    WebLiveConfig: [source('a'), source('b'), source('c')],
  };
  (getConfig as jest.Mock).mockResolvedValue(config);

  const response = await post({ action: 'sort', keys: ['b', 'a'] });

  expect(response.status).toBe(200);
  const saved = (db.saveAdminConfig as jest.Mock).mock.calls[0][0];
  expect(saved.WebLiveConfig.map((s: { key: string }) => s.key)).toEqual([
    'b',
    'a',
    'c',
  ]);
});

test('admin cannot flip the site-wide web live switch', async () => {
  process.env.USERNAME = 'someone-else';
  (getAuthInfoFromCookie as jest.Mock).mockReturnValue({
    username: 'admin-user',
  });
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue({
    role: 'admin',
    banned: false,
  });
  (getConfig as jest.Mock).mockResolvedValue({
    WebLiveEnabled: false,
    WebLiveConfig: [],
  });

  const response = await post({ action: 'toggleEnabled', enabled: true });

  expect(response.status).toBe(403);
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test('admin toggling to the same value does not change availability and still saves', async () => {
  process.env.USERNAME = 'someone-else';
  (getAuthInfoFromCookie as jest.Mock).mockReturnValue({
    username: 'admin-user',
  });
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue({
    role: 'admin',
    banned: false,
  });
  (getConfig as jest.Mock).mockResolvedValue({
    WebLiveEnabled: true,
    WebLiveConfig: [source('a')],
  });

  const response = await post({ action: 'toggleEnabled', enabled: true });

  expect(response.status).toBe(200);
  expect(db.saveAdminConfig).toHaveBeenCalledTimes(1);
});
