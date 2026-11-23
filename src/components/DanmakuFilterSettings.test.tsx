import { act, fireEvent, render, screen } from '@testing-library/react';

import DanmakuFilterSettings from './DanmakuFilterSettings';

jest.mock('@/lib/db.client', () => ({
  getDanmakuFilterConfig: jest.fn(async () => ({ rules: [] })),
  saveDanmakuFilterConfig: jest.fn(async () => undefined),
}));

const originalScrollTo = window.scrollTo;
beforeEach(() => {
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  window.scrollTo = originalScrollTo;
});

test('opens as a sheet in the shared modal layer and locks the page while open', async () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <DanmakuFilterSettings isOpen onClose={onClose} />
  );
  const layer = await screen.findByRole('dialog', {
    name: '弹幕关键字屏蔽设置',
  });
  expect(layer).toHaveClass('tm-modal-layer', 'tm-modal-layer--sheet');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
  jest.useFakeTimers();
  try {
    rerender(<DanmakuFilterSettings isOpen={false} onClose={onClose} />);
    act(() => {
      jest.advanceTimersByTime(300);
    });
  } finally {
    jest.useRealTimers();
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.position).toBe('');
});
