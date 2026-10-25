/** @jest-environment ./src/test/node-web-environment.cjs */
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { getUserFeatureAccess } from '@/lib/permissions';

jest.mock('@/lib/db', () => ({ db: { getUserInfoV2: jest.fn() } }));
jest.mock('@/lib/config', () => ({ getConfig: jest.fn() }));

const mockedDb = db as unknown as { getUserInfoV2: jest.Mock };
const mockedConfig = getConfig as jest.Mock;

function setup(
  user: { role?: string; tags?: string[]; banned?: boolean } | null,
  config: Record<string, unknown> = {}
) {
  mockedDb.getUserInfoV2.mockResolvedValue(
    user && { username: 'u', role: 'user', tags: [], ...user }
  );
  mockedConfig.mockResolvedValue({
    UserConfig: { Users: [], Tags: [{ name: 'g', permissions: ['music'] }] },
    ...config,
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'd1';
  process.env.USERNAME = 'boss';
});

test('without a group the user keeps full access (existing behaviour)', async () => {
  setup({});
  const access = await getUserFeatureAccess('u');
  expect(access.music).toBe(true);
  expect(access.emby).toBe(true);
});

test('a group only allows what it lists; new features default to everyone', async () => {
  setup({ tags: ['g'] });
  const access = await getUserFeatureAccess('u');
  expect(access.music).toBe(true);
  expect(access.emby).toBe(false);
  expect(access.movie_request).toBe(true);
});

test('policy "granted" closes a feature for everyone except granted users', async () => {
  setup(
    {},
    {
      FeaturePolicies: { music: 'granted' },
      FeatureGrants: { other: ['music'] },
    }
  );
  expect((await getUserFeatureAccess('u')).music).toBe(false);

  setup(
    {},
    {
      FeaturePolicies: { music: 'granted' },
      FeatureGrants: { u: ['music'] },
    }
  );
  expect((await getUserFeatureAccess('u')).music).toBe(true);
});

test('a single-user grant opens a feature the group does not include', async () => {
  setup({ tags: ['g'] }, { FeatureGrants: { u: ['emby'] } });
  const access = await getUserFeatureAccess('u');
  expect(access.emby).toBe(true);
  expect(access.live).toBe(false);
});

test('policy "everyone" overrides the group', async () => {
  setup({ tags: ['g'] }, { FeaturePolicies: { emby: 'everyone' } });
  expect((await getUserFeatureAccess('u')).emby).toBe(true);
});

test('owner, admin keep everything; banned and unknown users get nothing', async () => {
  setup({ role: 'admin' }, { FeaturePolicies: { music: 'granted' } });
  expect((await getUserFeatureAccess('u')).music).toBe(true);
  setup({ banned: true });
  expect((await getUserFeatureAccess('u')).music).toBe(false);
  setup(null);
  expect((await getUserFeatureAccess('u')).music).toBe(false);
  expect((await getUserFeatureAccess(null)).music).toBe(false);
});
