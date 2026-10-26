import { render, screen, waitFor } from '@testing-library/react';

import FeedbackInboxPanel from './FeedbackInboxPanel';

jest.mock('@/components/feedback/AppDialogs', () => ({
  notify: jest.fn(),
  notifyError: jest.fn(),
}));
const originalFetch = global.fetch;
const originalRects = HTMLElement.prototype.getClientRects;
const originalScroll = HTMLElement.prototype.scrollIntoView;
afterEach(() => {
  global.fetch = originalFetch;
  HTMLElement.prototype.getClientRects = originalRects;
  HTMLElement.prototype.scrollIntoView = originalScroll;
});

test('a resolved feedback target is visible and focused without changing its status', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        {
          id: 'f1',
          username: 'user',
          category: 'bug',
          message: '已处理的反馈内容',
          status: 'resolved',
          createdAt: 1,
        },
      ],
    }),
  });
  HTMLElement.prototype.getClientRects = jest.fn().mockReturnValue([{}]);
  HTMLElement.prototype.scrollIntoView = jest.fn();
  render(<FeedbackInboxPanel isOwner targetId='f1' />);
  const message = await screen.findByText('已处理的反馈内容');
  await waitFor(() => expect(message.closest('article')).toHaveFocus());
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByText(/待处理 0 条/)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('/api/feedback?all=1', {
    cache: 'no-store',
  });
});
