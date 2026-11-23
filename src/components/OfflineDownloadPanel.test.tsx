import { fireEvent, render, screen } from '@testing-library/react';

import { OfflineDownloadPanel } from './OfflineDownloadPanel';

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tasks: [] }),
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('offline downloads open in the shared modal layer and close on Escape', () => {
  const onClose = jest.fn();
  render(<OfflineDownloadPanel isOpen onClose={onClose} />);
  const layer = screen.getByRole('dialog', { name: '离线下载' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
