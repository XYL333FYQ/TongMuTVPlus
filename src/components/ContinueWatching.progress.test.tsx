import { act, render, screen } from '@testing-library/react';

import ContinueWatching from './ContinueWatching';

jest.mock('@/lib/db.client', () => {
  const records = Object.fromEntries(
    [
      ['over', 120, 100],
      ['negative', -20, 100],
      ['unknown', 20, 0],
    ].map(([key, play_time, total_time]) => [
      `fixture+${key}`,
      {
        title: key,
        cover: '',
        play_time,
        total_time,
        save_time: 1,
        total_episodes: 1,
        index: 1,
      },
    ])
  );
  return {
    getCachedPlayRecordsSnapshot: () => records,
    getAllPlayRecords: async () => records,
    subscribeToDataUpdates: () => jest.fn(),
  };
});
jest.mock('@/components/PlayRecordsPanel', () => () => null);
jest.mock('@/components/VirtualScrollableRow', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: ({ title, progress }: { title: string; progress: number }) => (
    <div role='progressbar' aria-label={title} aria-valuenow={progress} />
  ),
}));

test('keeps record progress inside zero to one hundred and handles unknown duration', async () => {
  await act(async () => {
    render(<ContinueWatching />);
  });
  expect(screen.getByRole('progressbar', { name: 'over' })).toHaveAttribute(
    'aria-valuenow',
    '100'
  );
  expect(screen.getByRole('progressbar', { name: 'negative' })).toHaveAttribute(
    'aria-valuenow',
    '0'
  );
  expect(screen.getByRole('progressbar', { name: 'unknown' })).toHaveAttribute(
    'aria-valuenow',
    '0'
  );
});
