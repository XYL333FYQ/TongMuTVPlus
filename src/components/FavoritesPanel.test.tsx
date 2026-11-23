jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: () => <div />,
}));
jest.mock('@/lib/db.client', () => ({
  getAllFavorites: jest.fn(async () => ({
    'fixture+1': { title: '验收影片', save_time: 1, total_episodes: 1 },
  })),
  getAllPlayRecords: jest.fn(async () => ({})),
  clearAllFavorites: jest.fn(async () => undefined),
  subscribeToDataUpdates: jest.fn(() => () => undefined),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { clearAllFavorites } from '@/lib/db.client';

import { FavoritesPanel } from './FavoritesPanel';

test('favorites open in the shared modal layer and clearing asks with the shared confirm', async () => {
  const onClose = jest.fn();
  render(<FavoritesPanel isOpen onClose={onClose} />);
  const layer = screen.getByRole('dialog', { name: '我的收藏' });
  expect(layer).toHaveClass('tm-modal-layer');
  expect(document.body.style.position).toBe('fixed');
  fireEvent.click(await screen.findByRole('button', { name: /清空/ }));
  const confirm = screen.getByRole('alertdialog', { name: '清空收藏' });
  expect(confirm).toHaveClass('tm-modal-layer--confirm');
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(clearAllFavorites).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent(layer, new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
