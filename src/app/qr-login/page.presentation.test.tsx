import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot, Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import QrLoginPage from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=local-qr-token'),
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: jest.fn(),
}));

const readAuth = jest.mocked(getAuthInfoFromBrowserCookie);

test('a signed-in phone hydrates the same initial view without rebuilding the QR confirmation page', async () => {
  readAuth.mockReturnValue(null);
  const html = renderToString(<QrLoginPage />);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  readAuth.mockReturnValue({ username: 'qa-user' });
  const recoverable = jest.fn();
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <QrLoginPage />, {
        onRecoverableError: recoverable,
      });
    });
    expect(screen.getByRole('button', { name: '确认登录' })).toBeEnabled();
    expect(
      screen.queryByRole('link', { name: '去登录' })
    ).not.toBeInTheDocument();
    expect(recoverable).not.toHaveBeenCalled();
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});

test('guest keeps the existing login redirect and signed-in confirmation sends the original token', async () => {
  readAuth.mockReturnValue(null);
  const guest = render(<QrLoginPage />);
  expect(screen.getByRole('link', { name: '去登录' })).toHaveAttribute(
    'href',
    '/login?redirect=%2Fqr-login%3Ftoken%3Dlocal-qr-token'
  );
  guest.unmount();
  readAuth.mockReturnValue({ username: 'qa-user' });
  const originalFetch = global.fetch;
  const request = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: '本地测试：二维码已失效' }),
  });
  global.fetch = request;
  try {
    render(<QrLoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '确认登录' }));
    await screen.findByText('本地测试：二维码已失效');
    expect(request).toHaveBeenCalledWith('/api/auth/qr/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'local-qr-token' }),
    });
  } finally {
    global.fetch = originalFetch;
  }
});
