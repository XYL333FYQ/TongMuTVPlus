/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: jest.fn(() => ({ username: 'owner' })),
}));
jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/lib/db', () => ({
  db: { saveAdminConfig: jest.fn(), getUserInfoV2: jest.fn() },
}));

import { NextRequest } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

import { POST } from './route';

const base = {
  enableBuiltInTheme: false,
  builtInTheme: 'default',
  customCSS: '',
  enableCache: true,
  cacheMinutes: 1440,
};

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('https://tongmu.test/api/admin/theme', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

const savedVersion = () =>
  (db.saveAdminConfig as jest.Mock).mock.calls[0][0].ThemeConfig
    .cacheVersion as number;

beforeEach(() => {
  process.env.USERNAME = 'owner';
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
  (db.saveAdminConfig as jest.Mock).mockReset();
});

test('switching from a built-in theme to empty custom CSS bumps the version', async () => {
  (getConfig as jest.Mock).mockResolvedValue({
    ThemeConfig: {
      ...base,
      enableBuiltInTheme: true,
      builtInTheme: 'dark_blue',
      cacheVersion: 4,
    },
  });

  const response = await post({ ...base });

  expect(response.status).toBe(200);
  expect(savedVersion()).toBe(5);
});

test('switching between two built-in themes bumps the version', async () => {
  (getConfig as jest.Mock).mockResolvedValue({
    ThemeConfig: {
      ...base,
      enableBuiltInTheme: true,
      builtInTheme: 'dark_blue',
      cacheVersion: 7,
    },
  });

  await post({ ...base, enableBuiltInTheme: true, builtInTheme: 'default' });

  expect(savedVersion()).toBe(8);
});

test('saving the same effective theme keeps the version', async () => {
  (getConfig as jest.Mock).mockResolvedValue({
    ThemeConfig: {
      ...base,
      enableBuiltInTheme: true,
      builtInTheme: 'dark_blue',
      customCSS: 'stale { }',
      cacheVersion: 3,
    },
  });

  // 内置主题生效时，自定义 CSS 的残留内容不影响实际样式
  await post({
    ...base,
    enableBuiltInTheme: true,
    builtInTheme: 'dark_blue',
    customCSS: 'other { }',
  });

  expect(savedVersion()).toBe(3);
});
