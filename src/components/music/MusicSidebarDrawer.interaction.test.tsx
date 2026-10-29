import { fireEvent, render, screen } from '@testing-library/react';

import MusicSidebarDrawer from './MusicSidebarDrawer';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = jest.fn();
});

test('music navigation opens a named native modal and keeps source-aware navigation and dismissal', () => {
  const close = jest.fn();
  const navigate = jest.fn();
  render(
    <MusicSidebarDrawer
      isOpen
      currentSource='tx'
      pathname='/music/rankings'
      onClose={close}
      onNavigate={navigate}
    />
  );
  const dialog = screen.getByRole('dialog', { name: '音乐菜单' });
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  expect(navigate).toHaveBeenCalledWith('/music/search?source=tx');
  expect(close).toHaveBeenCalledTimes(2);
});
