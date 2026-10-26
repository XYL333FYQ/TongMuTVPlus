/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));
jest.mock('@/lib/db', () => ({ db: { getGlobalValue: jest.fn() } }));
import { NextRequest } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

import { GET } from './route';

test('public server config includes owner release fields but no private payload', async () => {
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'sqlite';
  (getConfig as jest.Mock).mockResolvedValue({ SiteConfig: {} });
  (db.getGlobalValue as jest.Mock).mockResolvedValue(
    JSON.stringify({
      version: '0.2.0',
      entries: [
        {
          version: '0.2.0',
          date: '2026-10-25',
          added: ['公开文本'],
          changed: [],
          fixed: [],
        },
      ],
      secret: '不公开',
    })
  );
  const response = await GET(
    new NextRequest('https://tongmu.test/api/server-config')
  );
  const data = await response.json();
  expect(data.Version).toBe('0.2.0');
  expect(data.ReleaseInfo.entries[0].added).toEqual(['公开文本']);
  expect(data.ReleaseInfo.secret).toBeUndefined();
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
