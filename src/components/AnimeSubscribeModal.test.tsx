import { fireEvent, render, screen } from '@testing-library/react';

import AnimeSubscribeModal from './AnimeSubscribeModal';

test('the anime subscription dialog opens in the shared modal layer and closes on Escape', () => {
  const onClose = jest.fn();
  render(
    <AnimeSubscribeModal isOpen onClose={onClose} initialTitle='验收番剧' />
  );
  const layer = screen.getByRole('dialog', { name: '添加追番订阅' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
