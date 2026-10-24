import {
  checkAccountLock,
  recordAccountFailure,
  recordAccountSuccess,
} from './login-fail2ban';

beforeEach(() => {
  delete (globalThis as { __loginAccountLocks?: unknown }).__loginAccountLocks;
});

test('ten wrong passwords for one account lock it for 15 minutes regardless of IP', () => {
  const start = 1_000_000;
  for (let i = 0; i < 9; i++) recordAccountFailure('Admin', start + i);
  expect(checkAccountLock('admin', start + 10).banned).toBe(false);

  recordAccountFailure('admin', start + 20);
  const locked = checkAccountLock('ADMIN', start + 30);
  expect(locked.banned).toBe(true);
  expect(locked.retryAfterSeconds).toBe(15 * 60);

  expect(checkAccountLock('admin', start + 20 + 15 * 60 * 1000).banned).toBe(
    false
  );
});

test('failures outside the 15 minute window do not add up, and success clears the count', () => {
  const start = 2_000_000;
  for (let i = 0; i < 9; i++) recordAccountFailure('alice', start);
  recordAccountFailure('alice', start + 16 * 60 * 1000);
  expect(checkAccountLock('alice', start + 16 * 60 * 1000).banned).toBe(false);

  for (let i = 0; i < 9; i++) recordAccountFailure('bob', start);
  recordAccountSuccess('bob');
  recordAccountFailure('bob', start + 1);
  expect(checkAccountLock('bob', start + 2).banned).toBe(false);
});

test('missing or non-string usernames are ignored', () => {
  recordAccountFailure(undefined);
  recordAccountFailure({ name: 'x' });
  expect(checkAccountLock('').banned).toBe(false);
});
