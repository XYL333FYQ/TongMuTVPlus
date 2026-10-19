import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { clearAllPlayRecords } from '@/lib/db.client';

import ContinueWatching from './ContinueWatching';

jest.mock('@/lib/db.client', () => {
  const records = {
    'fixture+1': {
      title: '影片',
      source_name: '本地验收',
      cover: '/cover.svg',
      year: '2026',
      index: 1,
      total_episodes: 1,
      play_time: 20,
      total_time: 100,
      save_time: 1,
      new_episodes: 0,
    },
  };
  return {
    getCachedPlayRecordsSnapshot: () => records,
    getAllPlayRecords: async () => records,
    subscribeToDataUpdates: () => jest.fn(),
    clearAllPlayRecords: jest.fn(async () => undefined),
  };
});
jest.mock('@/components/PlayRecordsPanel', () => () => null);
jest.mock(
  '@/components/VideoCard',
  () =>
    function Card({ title }: { title: string }) {
      return <div>{title}</div>;
    }
);
jest.mock(
  '@/components/VirtualScrollableRow',
  () =>
    function Row({ children }: { children: React.ReactNode }) {
      return <div>{children}</div>;
    }
);
beforeEach(() => jest.clearAllMocks());

test('zero new episodes does not leak a bare zero beside the record', async () => {
  render(<ContinueWatching />);
  await screen.findByText('影片');
  expect(screen.queryByText('0', { exact: true })).not.toBeInTheDocument();
});
test('cancelling the named confirmation leaves records and storage intact', async () => {
  render(<ContinueWatching />);
  await screen.findByText('影片');
  fireEvent.click(screen.getByRole('button', { name: '清空' }));
  const dialog = screen.getByRole('alertdialog', { name: '清空播放记录' });
  fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  expect(clearAllPlayRecords).not.toHaveBeenCalled();
  expect(screen.getByText('影片')).toBeInTheDocument();
});
test('the existing clear operation only runs after confirmation', async () => {
  render(<ContinueWatching />);
  await screen.findByText('影片');
  fireEvent.click(screen.getByRole('button', { name: '清空' }));
  expect(clearAllPlayRecords).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确定清空' }));
  await waitFor(() => expect(clearAllPlayRecords).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByText('继续观看')).not.toBeInTheDocument()
  );
});
