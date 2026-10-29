import { act, fireEvent, render, screen } from '@testing-library/react';

import { NotificationPanel } from './NotificationPanel';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ role: 'owner' }),
}));
const originalFetch = global.fetch;
// jsdom 没有原生 <dialog> 模态接口，补一个最小实现
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  push.mockClear();
});

test.each([
  [
    'system',
    { feedbackId: 'f 1' },
    '/admin?section=feedbackInbox&feedbackId=f%201',
  ],
  [
    'movie_request',
    { requestId: 'r1' },
    '/admin?section=movieRequests&requestId=r1',
  ],
])(
  'clicking %s opens its admin section and only marks the notification read',
  async (type, metadata, url) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: 'n1',
            type,
            metadata,
            title: '新通知',
            message: '内容',
            timestamp: 1,
            read: false,
          },
        ],
      }),
    });
    const close = jest.fn();
    render(<NotificationPanel isOpen onClose={close} />);
    const notification = await screen.findByText('新通知');
    await act(async () => {
      fireEvent.click(notification);
    });
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(
          `^${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}&notice=\\d+$`
        )
      )
    );
    expect(close).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', notificationId: 'n1' }),
      })
    );
    expect(
      (global.fetch as jest.Mock).mock.calls.some(([url]) =>
        String(url).startsWith('/api/feedback')
      )
    ).toBe(false);
  }
);
