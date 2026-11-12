/** @jest-environment ./src/test/node-web-environment.cjs */
jest.mock('server-only', () => ({}));
const mockSites = jest.fn();
const mockUser = jest.fn();
const mockDetail = jest.fn();
const mockPermission = jest.fn();
jest.mock('@/lib/config', () => ({
  getAvailableApiSites: (...args: unknown[]) => mockSites(...args),
  getConfig: async () => ({}),
}));
jest.mock('@/lib/db', () => ({
  db: { getUserInfoV2: (...args: unknown[]) => mockUser(...args) },
}));
jest.mock('@/lib/downstream', () => ({
  getDetailFromApiV2: (...args: unknown[]) => mockDetail(...args),
}));
jest.mock('@/lib/permissions', () => ({
  hasFeaturePermission: (...args: unknown[]) => mockPermission(...args),
}));
jest.mock('@/lib/special-sources-detail', () => ({
  getSpecialSourceDetail: jest.fn(),
}));
jest.mock('@/lib/source-script', () => ({
  parseScriptSourceValue: () => null,
}));
import { NextRequest } from 'next/server';
import { resolveSiteRoomMedia } from './media-source';

const ref = {
  id: 'ref',
  roomId: 'room_one',
  ownerIdentityId: 'identity',
  ownerAccountId: 'alice',
  ownerIncarnation: 'account:1',
  source: 'catalog',
  filmId: 'film-1',
  episodeIndex: 1,
  kind: 'movie',
};
const request = () =>
  new NextRequest('http://localhost/api/together/media/ref');
beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({ role: 'user', banned: false, created_at: 1 });
  mockPermission.mockResolvedValue(true);
  mockSites.mockImplementation(async (_user, special) =>
    special
      ? []
      : [{ key: 'catalog', name: 'Fixture', api: 'https://catalog.test/api' }]
  );
  mockDetail.mockResolvedValue({
    id: 'film-1',
    source: 'catalog',
    title: 'Film',
    poster: 'https://poster.test/image.jpg',
    episodes: ['https://media.test/1.mp4', 'https://media.test/2.m3u8'],
    episodes_titles: ['First', 'Second'],
  });
});
test('resolves the selected episode using strict source identity and returns private URLs only internally', async () => {
  const result = await resolveSiteRoomMedia(ref, 'bob', request());
  expect(result.url).toBe('https://media.test/2.m3u8');
  expect(result.format).toBe('hls');
  expect(result.episodeTitle).toBe('Second');
  expect(result.trustedHosts).toEqual(['catalog.test']);
  expect(mockDetail).toHaveBeenCalledWith(
    expect.objectContaining({ key: 'catalog' }),
    'film-1',
    { requireExactId: true }
  );
});
test('source ACL and private-library permission failures happen before resolving media', async () => {
  mockSites.mockImplementation(async (user) =>
    user === 'bob' ? [] : [{ key: 'catalog', api: 'https://catalog.test' }]
  );
  await expect(
    resolveSiteRoomMedia(ref, 'bob', request())
  ).rejects.toMatchObject({ status: 403 });
  expect(mockDetail).not.toHaveBeenCalled();
  mockPermission.mockResolvedValue(false);
  await expect(
    resolveSiteRoomMedia({ ...ref, source: 'openlist' }, 'bob', request())
  ).rejects.toMatchObject({ status: 403 });
});
test('missing episodes and deleted/recreated source owners cannot silently fall back to another film', async () => {
  await expect(
    resolveSiteRoomMedia({ ...ref, episodeIndex: 99 }, 'bob', request())
  ).rejects.toMatchObject({ status: 404 });
  mockUser.mockResolvedValue({ role: 'user', banned: false, created_at: 2 });
  await expect(
    resolveSiteRoomMedia(ref, 'bob', request())
  ).rejects.toMatchObject({ status: 403 });
});
