/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'admin-user' }),
}));
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(),
  configSelfCheck: jest.fn((config) => config),
  setCachedConfig: jest.fn(),
}));
jest.mock('@/lib/db', () => ({
  db: {
    getUserInfoV2: jest.fn(),
    saveAdminConfig: jest.fn(),
  },
}));

import { NextRequest } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';

import { POST } from './route';

const baseConfig = {
  SiteConfig: { SiteName: '站点', EnableMovieRequest: false },
  MusicConfig: { Enabled: false, BaseUrl: '', Token: '', ProxyEnabled: true },
  LiveConfig: [{ key: 'a', name: 'a', url: 'u', from: 'custom' }],
};

const post = (payload: unknown) =>
  POST(
    new NextRequest('https://tongmu.test/api/admin/config', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );

beforeEach(() => {
  process.env.USERNAME = 'owner';
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue({
    role: 'admin',
    banned: false,
  });
  (getConfig as jest.Mock).mockResolvedValue(
    JSON.parse(JSON.stringify(baseConfig))
  );
  (db.saveAdminConfig as jest.Mock).mockReset();
  (setCachedConfig as jest.Mock).mockReset();
});

test('admin cannot enable a module the site owner closed', async () => {
  const response = await post({
    ...baseConfig,
    MusicConfig: { ...baseConfig.MusicConfig, Enabled: true },
  });

  expect(response.status).toBe(403);
  const data = await response.json();
  expect(data.error).toContain('只有站长可以开放或关闭站点功能');
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test('admin cannot re-enable movie requests the site owner disabled', async () => {
  const response = await post({
    ...baseConfig,
    SiteConfig: { ...baseConfig.SiteConfig, EnableMovieRequest: true },
  });

  expect(response.status).toBe(403);
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test('admin can still save non-availability changes like the music address', async () => {
  const response = await post({
    ...baseConfig,
    SiteConfig: { ...baseConfig.SiteConfig, SiteName: '新名字' },
    MusicConfig: { ...baseConfig.MusicConfig, BaseUrl: 'https://lx.test' },
  });

  expect(response.status).toBe(200);
  expect(db.saveAdminConfig).toHaveBeenCalledTimes(1);
  const saved = (db.saveAdminConfig as jest.Mock).mock.calls[0][0];
  expect(saved.SiteConfig.SiteName).toBe('新名字');
  expect(saved.MusicConfig.Enabled).toBe(false);
});

test('site owner can still open or close modules', async () => {
  process.env.USERNAME = 'admin-user';
  const response = await post({
    ...baseConfig,
    MusicConfig: { ...baseConfig.MusicConfig, Enabled: true },
  });

  expect(response.status).toBe(200);
  expect(db.saveAdminConfig).toHaveBeenCalledTimes(1);
});

test('ordinary members cannot save config at all', async () => {
  (db.getUserInfoV2 as jest.Mock).mockResolvedValue({
    role: 'user',
    banned: false,
  });
  const response = await post(baseConfig);

  expect(response.status).toBe(401);
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test.each(['OpenListConfig', 'XiaoyaConfig', 'SuwayomiConfig'])(
  'admin cannot flip %s even while it is not fully configured',
  async (key) => {
    const response = await post({ ...baseConfig, [key]: { Enabled: true } });
    expect(response.status).toBe(403);
    expect(db.saveAdminConfig).not.toHaveBeenCalled();
  }
);

test('admin cannot enable another private provider while the library is already available', async () => {
  const current = {
    ...baseConfig,
    XiaoyaConfig: { Enabled: true, ServerURL: 'https://xiaoya.test' },
    EmbyConfig: {
      Sources: [{ key: 'e', enabled: false, ServerURL: 'https://emby.test' }],
    },
  };
  (getConfig as jest.Mock).mockResolvedValue(current);
  const response = await post({
    ...current,
    EmbyConfig: {
      Sources: [{ ...current.EmbyConfig.Sources[0], enabled: true }],
    },
  });
  expect(response.status).toBe(403);
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test('admin cannot activate a pre-checked incomplete provider through generic config', async () => {
  const current = {
    ...baseConfig,
    XiaoyaConfig: { Enabled: true, ServerURL: 'https://xiaoya.test' },
    OpenListConfig: { Enabled: true, URL: '', Username: 'u', Password: 'p' },
  };
  (getConfig as jest.Mock).mockResolvedValue(current);
  const response = await post({
    ...current,
    OpenListConfig: { ...current.OpenListConfig, URL: 'https://openlist.test' },
  });
  expect(response.status).toBe(403);
  expect(db.saveAdminConfig).not.toHaveBeenCalled();
});

test.each([
  { MusicConfig: { Enabled: 'true' } },
  { OPDSConfig: { Enabled: 'true' } },
  { WebLiveEnabled: 'true' },
])(
  'admin cannot bypass module switches using a non-boolean payload: %j',
  async (payload) => {
    const response = await post({ ...baseConfig, ...payload });
    expect(response.status).toBe(403);
    expect(db.saveAdminConfig).not.toHaveBeenCalled();
  }
);
