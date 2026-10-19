jest.mock('@/components/VideoCard', () => ({
  __esModule: true,
  default: () => <div />,
}));
jest.mock('@/lib/db.client', () => ({
  getAllPlayRecords: jest.fn(async () => ({
    'fixture+1': {
      title: '验收影片',
      save_time: 1,
      total_time: 100,
      play_time: 20,
      total_episodes: 1,
      index: 1,
    },
  })),
  clearAllPlayRecords: jest.fn(async () => undefined),
  deletePlayRecords: jest.fn(),
  subscribeToDataUpdates: jest.fn(() => () => undefined),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { clearAllPlayRecords } from '@/lib/db.client';

import PlayRecordsPanel from './PlayRecordsPanel';

test('clearing all records requires confirmation and cancel never deletes', async () => {
  render(<PlayRecordsPanel isOpen onClose={jest.fn()} />);
  const clear = await screen.findByRole('button', { name: '清空全部' });
  fireEvent.click(clear);
  expect(
    screen.getByText('清空全部观看记录？此操作不能撤销')
  ).toBeInTheDocument();
  expect(clearAllPlayRecords).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(clearAllPlayRecords).not.toHaveBeenCalled();
  fireEvent.click(clear);
  fireEvent.click(screen.getByRole('button', { name: '确定清空' }));
  await waitFor(() => expect(clearAllPlayRecords).toHaveBeenCalledTimes(1));
});
