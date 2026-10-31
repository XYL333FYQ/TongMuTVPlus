import { clearAuthCookie, getAuthInfoFromBrowserCookie } from './auth';

const clearAll = () => {
  for (const name of ['auth', 'auth_info']) {
    document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
};

afterEach(clearAll);

test('reads the display cookie written by new logins', () => {
  document.cookie =
    'auth_info=' +
    encodeURIComponent(JSON.stringify({ username: 'alice', role: 'user' })) +
    '; path=/';
  expect(getAuthInfoFromBrowserCookie()).toMatchObject({
    username: 'alice',
    role: 'user',
  });
});

test('sessions from before the upgrade (readable auth cookie) keep working', () => {
  document.cookie =
    'auth=' +
    encodeURIComponent(JSON.stringify({ username: 'bob', role: 'admin' })) +
    '; path=/';
  expect(getAuthInfoFromBrowserCookie()?.username).toBe('bob');
});

test('clearing on the client removes the display cookie so the page shows signed out', () => {
  document.cookie =
    'auth_info=' +
    encodeURIComponent(JSON.stringify({ username: 'c' })) +
    '; path=/';
  clearAuthCookie();
  expect(getAuthInfoFromBrowserCookie()).toBeNull();
});
