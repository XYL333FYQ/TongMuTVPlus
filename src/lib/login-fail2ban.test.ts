import {
  checkAccountLock,
  recordAccountFailure,
  recordAccountSuccess,
} from './login-fail2ban';

beforeEach(() => {
  delete (globalThis as { __loginAccountLocks?: unknown }).__loginAccountLocks;
  delete (globalThis as { __loginTrustedIps?: unknown }).__loginTrustedIps;
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

test('a locked account still lets in IPs that logged in to it before', () => {
  const start = 3_000_000;
  recordAccountSuccess('owner', '203.0.113.7', start);
  for (let i = 0; i < 10; i++) recordAccountFailure('owner', start + 1 + i);

  expect(checkAccountLock('owner', start + 20, '198.51.100.9').banned).toBe(
    true
  );
  expect(checkAccountLock('owner', start + 20).banned).toBe(true);
  expect(checkAccountLock('owner', start + 20, '203.0.113.7').banned).toBe(
    false
  );
});

test('trust expires after 30 days and only the latest five IPs are kept', () => {
  const start = 4_000_000;
  for (let i = 1; i <= 6; i++)
    recordAccountSuccess('eve', `10.0.0.${i}`, start);
  for (let i = 0; i < 10; i++) recordAccountFailure('eve', start + 1 + i);
  expect(checkAccountLock('eve', start + 20, '10.0.0.1').banned).toBe(true);
  expect(checkAccountLock('eve', start + 20, '10.0.0.6').banned).toBe(false);

  const later = start + 31 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 10; i++) recordAccountFailure('eve', later + i);
  expect(checkAccountLock('eve', later + 20, '10.0.0.6').banned).toBe(true);
});
