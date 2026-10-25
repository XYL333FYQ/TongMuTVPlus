/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'manager' }),
}));
jest.mock('@/lib/db', () => ({
  db: { getUserInfoV2: jest.fn(async () => ({ role: 'admin' })) },
}));
jest.mock('@/lib/source-script', () => ({
  listSourceScripts: jest.fn(),
  saveSourceScript: jest.fn(),
  importSourceScripts: jest.fn(),
  deleteSourceScript: jest.fn(),
  toggleSourceScriptEnabled: jest.fn(),
  getDefaultSourceScriptTemplate: jest.fn(),
  testSourceScript: jest.fn(),
}));

import { NextRequest } from 'next/server';
import {
  listSourceScripts,
  saveSourceScript,
  importSourceScripts,
  deleteSourceScript,
  toggleSourceScriptEnabled,
} from '@/lib/source-script';
import { POST } from './route';

const post = (body: unknown) =>
  POST(
    new NextRequest('https://site.test/api/admin/source-script', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
beforeEach(() => {
  jest.clearAllMocks();
  process.env.USERNAME = 'owner';
  (listSourceScripts as jest.Mock).mockResolvedValue([]);
});

test.each([
  { action: 'save', key: 'new', name: 'new', code: 'code' },
  { action: 'import', items: [{ key: 'new', name: 'new', code: 'code' }] },
])('admin cannot open advanced recommendations via $action', async (body) => {
  expect((await post(body)).status).toBe(403);
  expect(saveSourceScript).not.toHaveBeenCalled();
  expect(importSourceScripts).not.toHaveBeenCalled();
});

test.each(['delete', 'toggle_enabled'])(
  'admin cannot close advanced recommendations via %s',
  async (action) => {
    (listSourceScripts as jest.Mock).mockResolvedValue([
      { id: 'one', key: 'one', enabled: true },
    ]);
    expect((await post({ action, id: 'one' })).status).toBe(403);
    expect(deleteSourceScript).not.toHaveBeenCalled();
    expect(toggleSourceScriptEnabled).not.toHaveBeenCalled();
  }
);

test('admin may maintain script code while availability stays the same', async () => {
  (listSourceScripts as jest.Mock).mockResolvedValue([
    { id: 'one', key: 'one', enabled: true },
  ]);
  expect(
    (
      await post({
        action: 'save',
        id: 'one',
        key: 'one',
        name: 'one',
        code: 'updated',
      })
    ).status
  ).toBe(200);
  expect(saveSourceScript).toHaveBeenCalledTimes(1);
});

test('owner may open advanced recommendations', async () => {
  process.env.USERNAME = 'manager';
  expect(
    (await post({ action: 'save', key: 'new', name: 'new', code: 'code' }))
      .status
  ).toBe(200);
});
