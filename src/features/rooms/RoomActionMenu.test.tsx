import { fireEvent, render, screen } from '@testing-library/react';

import RoomActionMenu from './RoomActionMenu';

test('keyboard navigation skips disabled actions, cycles, and Escape restores trigger focus', () => {
  render(
    <RoomActionMenu
      label='影片操作'
      items={[
        { label: '上移', disabled: true, onSelect: jest.fn() },
        { label: '下移', onSelect: jest.fn() },
        { label: '移除', onSelect: jest.fn() },
      ]}
    />
  );
  const trigger = screen.getByRole('button', { name: '影片操作' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: '下移' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: '移除' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: '下移' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
  expect(screen.getByRole('menuitem', { name: '移除' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
  expect(screen.getByRole('menuitem', { name: '下移' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('selection invokes the original action once and outside click dismisses without selecting', () => {
  const select = jest.fn();
  render(
    <RoomActionMenu
      label='影片操作'
      items={[{ label: '移除', onSelect: select }]}
    />
  );
  const trigger = screen.getByRole('button', { name: '影片操作' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: '移除' }));
  expect(select).toHaveBeenCalledTimes(1);
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(select).toHaveBeenCalledTimes(1);
});
