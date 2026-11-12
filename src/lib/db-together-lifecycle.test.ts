/** @jest-environment ./src/test/node-web-environment.cjs */
const mockStorage = {
  deleteUser: jest.fn(async () => undefined),
  deleteUserV2: jest.fn(async () => undefined),
  updateUserInfoV2: jest.fn(async () => undefined),
};
jest.mock('./redis.db', () => ({ RedisStorage: jest.fn(() => mockStorage) }));
import { registerTogetherLifecycle } from '../../server/together/lifecycle.cjs';
test('deletion and disabling notify bridge without coupling database to native runtime', async () => {
  const previous = process.env.NEXT_PUBLIC_STORAGE_TYPE;
  process.env.NEXT_PUBLIC_STORAGE_TYPE = 'redis';
  const listener = jest.fn(),
    unregister = registerTogetherLifecycle(listener);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { db } = require('./db') as typeof import('./db');
    await db.deleteUser('old');
    await db.deleteUserV2('alice');
    await db.updateUserInfoV2('bob', { banned: true });
    await db.updateUserInfoV2('carol', { banned: false });
    await db.updateUserInfoV2('dan', { tags: ['a'] });
    expect(listener.mock.calls).toEqual([
      ['old', { deleted: true }],
      ['alice', { deleted: true }],
      ['bob', {}],
    ]);
  } finally {
    unregister();
    if (previous === undefined) delete process.env.NEXT_PUBLIC_STORAGE_TYPE;
    else process.env.NEXT_PUBLIC_STORAGE_TYPE = previous;
  }
});
