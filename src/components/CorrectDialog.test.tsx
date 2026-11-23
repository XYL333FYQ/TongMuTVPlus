import { fireEvent, render, screen } from '@testing-library/react';

import CorrectDialog from './CorrectDialog';

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [] }),
  });
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('the correction dialog opens in the shared modal layer and closes on Escape', () => {
  const onClose = jest.fn();
  render(
    <CorrectDialog
      isOpen
      onClose={onClose}
      videoKey='fixture+1'
      currentTitle='验收影片'
      onCorrect={jest.fn()}
    />
  );
  const layer = screen.getByRole('dialog', { name: '影片纠错' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the playback side panel stays a non-modal panel', () => {
  render(
    <CorrectDialog
      isOpen
      onClose={jest.fn()}
      videoKey='fixture+1'
      currentTitle='验收影片'
      onCorrect={jest.fn()}
      useDrawer
    />
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.position).toBe('');
});
