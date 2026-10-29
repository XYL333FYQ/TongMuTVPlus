import { fireEvent, render, screen, within } from '@testing-library/react';

import { downloadDB } from '@/lib/download-db';

import { DownloadManagementPanel } from './DownloadManagementPanel';

jest.mock('@/lib/download-db', () => ({
  downloadDB: {
    getCompletedTasks: jest.fn(async () => [
      {
        id: 'qa',
        title: '测试影片 第1集',
        videoTitle: '测试影片',
        source: 'qa',
        videoId: '1',
        episodeIndex: 0,
        completedAt: 1,
        downloadMode: 'browser',
      },
    ]),
    deleteCompletedTasks: jest.fn(),
  },
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = jest.fn(function (
    this: HTMLDialogElement
  ) {
    this.removeAttribute('open');
  });
});

test('download confirmation can be cancelled above its parent without deleting records or closing management', async () => {
  const close = jest.fn();
  render(<DownloadManagementPanel isOpen onClose={close} />);
  await screen.findByText('测试影片');
  fireEvent.click(screen.getByLabelText('全选'));
  fireEvent.click(screen.getByRole('button', { name: '删除选中' }));
  const confirmation = screen.getByRole('alertdialog', { name: '确认删除' });
  fireEvent.click(within(confirmation).getByRole('button', { name: '取消' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '下载管理' })).toBeInTheDocument();
  expect(downloadDB.deleteCompletedTasks).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '关闭下载文件管理' }));
  expect(close).toHaveBeenCalledTimes(1);
});

test('download groups and individual selections are native keyboard controls', async () => {
  render(<DownloadManagementPanel isOpen onClose={jest.fn()} />);
  await screen.findByText('测试影片');
  const disclosure = screen.getByRole('button', { name: '展开 测试影片' });
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  const episode = screen.getByRole('button', {
    name: /第 1 集/,
    pressed: false,
  });
  fireEvent.click(episode);
  expect(episode).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/已选择 1 \/ 1 集/)).toBeInTheDocument();
});
