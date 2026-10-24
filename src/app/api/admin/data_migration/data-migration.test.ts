/** @jest-environment ./src/test/node-web-environment.cjs */

// 备份/恢复路由的回归测试：用内存版 db，加密换成原样透传，只验证路由自己的逻辑
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromCookie: () => ({ username: 'owner' }),
}));
jest.mock('@/lib/crypto', () => ({
  SimpleCrypto: {
    encrypt: (data: string) => data,
    decrypt: (data: string) => data,
  },
}));
jest.mock('@/lib/config', () => ({
  configSelfCheck: (config: unknown) => config,
  setCachedConfig: jest.fn(),
}));
jest.mock('@/lib/version', () => ({ CURRENT_VERSION: 'test' }));
jest.mock('@/lib/data-migration-progress', () => ({
  updateProgress: jest.fn(),
  clearProgress: jest.fn(),
}));
jest.mock('@/lib/db', () => ({
  get db() {
    return mockDb;
  },
}));

import { NextRequest } from 'next/server';
import { gunzipSync, gzipSync } from 'zlib';

import { POST as exportBackup } from './export/route';
import { POST as importBackup } from './import/route';

const resolved = (value: unknown) => jest.fn(async () => value);
// 路由里按 any 调用 db 和 db.storage，测试替身同样不限定类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb: Record<string, any> = {};

function resetDb() {
  Object.assign(mockDb, {
    getAdminConfig: resolved({ SiteConfig: {} }),
    getUserListV2: resolved({ users: [] }),
    getAllUsers: resolved(['alice']),
    getAllPlayRecords: resolved({}),
    getAllFavorites: resolved({}),
    getSearchHistory: resolved([]),
    getAllSkipConfigs: resolved({}),
    listMusicV2History: resolved([]),
    listMusicV2Playlists: resolved([]),
    listMusicV2PlaylistItems: resolved([]),
    getAllMangaShelf: resolved({}),
    getAllMangaReadRecords: resolved({}),
    getAllBookShelf: resolved({}),
    getAllBookReadRecords: resolved({}),
    clearAllData: resolved(undefined),
    deleteUserV2: resolved(undefined),
    saveAdminConfig: resolved(undefined),
    deleteGlobalValue: resolved(undefined),
    addSearchHistory: resolved(undefined),
    setSkipConfig: resolved(undefined),
    batchUpsertMusicV2History: resolved(undefined),
    createMusicV2Playlist: resolved(undefined),
    addMusicV2PlaylistItem: resolved(undefined),
    saveMangaShelf: resolved(undefined),
    saveMangaReadRecord: resolved(undefined),
    saveBookShelf: resolved(undefined),
    saveBookReadRecord: resolved(undefined),
    storage: {
      getUserPasswordHash: resolved('hashed-password'),
      createUserWithHashedPassword: resolved(undefined),
      setPlayRecord: resolved(undefined),
      setFavorite: resolved(undefined),
    },
  });
}

function backupFile(userData: Record<string, unknown>) {
  const payload = {
    timestamp: '2026-10-01T00:00:00.000Z',
    serverVersion: 'test',
    data: { adminConfig: { SiteConfig: {} }, userData, usersV2: [] },
  };
  return gzipSync(JSON.stringify(payload)).toString('base64');
}

function importRequest(file: string) {
  const form = new FormData();
  form.append('file', new File([file], 'backup.dat'));
  form.append('password', 'backup-password');
  return new NextRequest(
    'https://tongmu.test/api/admin/data_migration/import',
    {
      method: 'POST',
      body: form,
    }
  );
}

function exportRequest() {
  return new NextRequest(
    'https://tongmu.test/api/admin/data_migration/export',
    {
      method: 'POST',
      body: JSON.stringify({ password: 'backup-password' }),
    }
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
  process.env.USERNAME = 'owner';
  resetDb();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('a backup without manga or book data keeps the existing shelves and reading progress', async () => {
  const mangaItem = { sourceId: 's', mangaId: 'm1', title: '漫画' };
  const mangaRecord = { sourceId: 's', mangaId: 'm1', chapter: 3 };
  const bookItem = { sourceId: 'b', bookId: 'b1', title: '书' };
  const bookRecord = { sourceId: 'b', bookId: 'b1', progress: 0.4 };
  mockDb.getAllMangaShelf = resolved({ 's+m1': mangaItem });
  mockDb.getAllMangaReadRecords = resolved({ 's+m1': mangaRecord });
  mockDb.getAllBookShelf = resolved({ 'b+b1': bookItem });
  mockDb.getAllBookReadRecords = resolved({ 'b+b1': bookRecord });

  const response = await importBackup(
    importRequest(backupFile({ alice: { passwordV2: 'hash' } }))
  );
  const result = await response.json();

  expect(response.status).toBe(200);
  expect(mockDb.clearAllData).toHaveBeenCalled();
  expect(mockDb.saveMangaShelf).toHaveBeenCalledWith(
    'alice',
    's',
    'm1',
    mangaItem
  );
  expect(mockDb.saveMangaReadRecord).toHaveBeenCalledWith(
    'alice',
    's',
    'm1',
    mangaRecord
  );
  expect(mockDb.saveBookShelf).toHaveBeenCalledWith(
    'alice',
    'b',
    'b1',
    bookItem
  );
  expect(mockDb.saveBookReadRecord).toHaveBeenCalledWith(
    'alice',
    'b',
    'b1',
    bookRecord
  );
  expect(result).toMatchObject({
    importedUsers: 1,
    preservedMangaData: true,
    preservedBookData: true,
  });
});

test('a backup that includes manga data restores exactly that data, not the old shelf', async () => {
  mockDb.getAllMangaShelf = resolved({
    old: { sourceId: 'x', mangaId: 'old' },
  });
  const fromBackup = { sourceId: 's', mangaId: 'new' };
  await importBackup(
    importRequest(
      backupFile({
        alice: {
          passwordV2: 'hash',
          mangaData: { shelf: { 's+new': fromBackup }, readRecords: {} },
        },
      })
    )
  );
  expect(mockDb.saveMangaShelf).toHaveBeenCalledTimes(1);
  expect(mockDb.saveMangaShelf).toHaveBeenCalledWith(
    'alice',
    's',
    'new',
    fromBackup
  );
});

test('a user whose data fails to restore is reported, not counted as imported', async () => {
  mockDb.storage.setPlayRecord = jest.fn(async () => {
    throw new Error('database unavailable');
  });
  const response = await importBackup(
    importRequest(
      backupFile({
        alice: { passwordV2: 'hash', playRecords: { 'a+1': { title: 'x' } } },
        bob: { passwordV2: 'hash' },
      })
    )
  );
  const result = await response.json();

  expect(response.status).toBe(500);
  expect(result.failedUsers).toEqual(['alice']);
  expect(result.importedUsers).toBe(1);
  expect(result.error).toContain('alice');
});

test('a successful export contains every user', async () => {
  const response = await exportBackup(exportRequest());
  expect(response.status).toBe(200);
  const backup = JSON.parse(
    gunzipSync(Buffer.from(await response.text(), 'base64')).toString()
  );
  expect(Object.keys(backup.data.userData).sort()).toEqual(['alice', 'owner']);
});

test('a read failure for one user cancels the export instead of silently leaving them out', async () => {
  mockDb.getAllFavorites = jest.fn(async (name: string) => {
    if (name === 'alice') throw new Error('timeout');
    return {};
  });
  const response = await exportBackup(exportRequest());
  expect(response.status).toBe(500);
  expect((await response.json()).error).toContain('alice');
});

test('a failure reading a password is not mistaken for "user has no password"', async () => {
  mockDb.storage.getUserPasswordHash = jest.fn(async () => {
    throw new Error('connection reset');
  });
  const response = await exportBackup(exportRequest());
  expect(response.status).toBe(500);
});
