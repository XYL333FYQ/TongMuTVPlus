import { getAuthSigningSecret } from './auth-secret';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

test('cookies are signed with AUTH_SECRET instead of the owner password when it is set', () => {
  process.env.PASSWORD = 'owner-password';
  process.env.AUTH_SECRET = 'a'.repeat(64);
  expect(getAuthSigningSecret()).toBe('a'.repeat(64));
});

test('falls back to PASSWORD where no AUTH_SECRET can be provisioned', () => {
  delete process.env.AUTH_SECRET;
  process.env.PASSWORD = 'owner-password';
  expect(getAuthSigningSecret()).toBe('owner-password');
});
