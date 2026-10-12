import { cleanup, render } from '@testing-library/react';

import { TokenRefreshManager } from './TokenRefreshManager';

let mockAuth: {
  username: string;
  timestamp: number;
  refreshExpires: number;
} | null = null;
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => mockAuth,
  clearAuthCookie: jest.fn(),
}));
jest.mock('@/lib/tv-mode', () => ({
  isLoginPathname: () => false,
  resolveLoginPath: () => '/login',
}));

const originalFetch = window.fetch;
function response(status: number) {
  return {
    status,
    ok: status === 200,
    clone: () => ({ text: async () => 'Unauthorized' }),
  } as Response;
}
beforeEach(() => {
  mockAuth = null;
  window.RUNTIME_CONFIG = { STORAGE_TYPE: 'd1' };
});
afterEach(() => {
  cleanup();
  window.fetch = originalFetch;
  delete window.RUNTIME_CONFIG;
  jest.restoreAllMocks();
});

test('an unauthenticated visitor receives a protected API 401 without refresh or logout requests', async () => {
  const fetchRequest = jest.fn().mockResolvedValue(response(401));
  window.fetch = fetchRequest;
  render(<TokenRefreshManager />);

  expect((await window.fetch('/api/notifications')).status).toBe(401);
  expect(fetchRequest.mock.calls).toEqual([['/api/notifications', undefined]]);
});

test('a signed-in viewer still refreshes and retries one expired protected request', async () => {
  mockAuth = {
    username: 'viewer',
    timestamp: Date.now(),
    refreshExpires: Date.now() + 3600000,
  };
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const fetchRequest = jest
    .fn()
    .mockResolvedValueOnce(response(401))
    .mockResolvedValueOnce(response(200))
    .mockResolvedValueOnce(response(200));
  window.fetch = fetchRequest;
  render(<TokenRefreshManager />);

  expect((await window.fetch('/api/notifications')).status).toBe(200);
  expect(fetchRequest.mock.calls.map((call) => call[0])).toEqual([
    '/api/notifications',
    '/api/auth/refresh',
    '/api/notifications',
  ]);
});
