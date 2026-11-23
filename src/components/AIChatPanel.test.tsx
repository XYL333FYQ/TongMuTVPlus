jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'audit-user' }),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import AIChatPanel from './AIChatPanel';

const originalScrollTo = window.scrollTo;
beforeEach(() => {
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = jest.fn();
});
afterEach(() => {
  window.scrollTo = originalScrollTo;
});

test('the chat opens in the shared modal layer, locks the page and closes on Escape', () => {
  const onClose = jest.fn();
  const { rerender } = render(<AIChatPanel isOpen onClose={onClose} />);
  const layer = screen.getByRole('dialog', { name: 'AI影视助手' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<AIChatPanel isOpen={false} onClose={onClose} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.position).toBe('');
});

test('the side panel on the playback page is not a modal and leaves the page usable', () => {
  render(<AIChatPanel isOpen onClose={jest.fn()} useDrawer />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('AI影视助手')).toBeInTheDocument();
  expect(document.body.style.position).toBe('');
});
