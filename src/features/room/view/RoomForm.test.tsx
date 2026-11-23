import { render, screen } from '@testing-library/react';

import { Dialog } from './RoomForm';

test('a room panel opens in the drawer variant', () => {
  render(
    <Dialog title='片单' onClose={jest.fn()} sheet>
      <p>内容</p>
    </Dialog>
  );
  expect(screen.getByRole('dialog', { name: '片单' })).toHaveClass(
    'tm-modal-layer',
    'tm-modal-layer--drawer'
  );
});

test('a room dialog without sheet keeps the default variant', () => {
  render(
    <Dialog title='创建房间' onClose={jest.fn()}>
      <p>内容</p>
    </Dialog>
  );
  const dialog = screen.getByRole('dialog', { name: '创建房间' });
  expect(dialog).toHaveClass('tm-modal-layer');
  expect(dialog.className).not.toMatch(/tm-modal-layer--/);
});
