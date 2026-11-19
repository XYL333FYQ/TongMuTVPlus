import { fireEvent, render, screen } from '@testing-library/react';

import PlaylistPanel from './PlaylistPanel';

import type { RoomQueueItem } from '@/types/watch-room';

const item = (id: string, title: string, extra: Partial<RoomQueueItem> = {}) =>
  ({ id, title, addedBy: 'eren', ...extra } as RoomQueueItem);

function setup(overrides: Partial<Parameters<typeof PlaylistPanel>[0]> = {}) {
  const props = {
    detail: null,
    episodeIndex: 0,
    playing: false,
    queue: [item('a', '可能的爱'), item('b', '蜘蛛侠', { addedBy: 'me' })],
    self: 'me',
    canChangeMedia: true,
    canAdd: true,
    canManage: true,
    onEpisode: jest.fn(),
    onPlayItem: jest.fn(),
    onRemove: jest.fn(),
    onMove: jest.fn(),
    onClearPlayed: jest.fn(),
    onAdd: jest.fn(),
    onStop: jest.fn(),
    ...overrides,
  };
  render(<PlaylistPanel {...props} />);
  return props;
}

test('each queued film shows who added it, plays now, and keeps reorder and remove under “more”', () => {
  const props = setup();
  expect(screen.getByText('eren 加的')).toBeInTheDocument();
  expect(screen.getByText('我加的')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '现在放《可能的爱》' }));
  expect(props.onPlayItem).toHaveBeenCalledWith(props.queue[0]);
  expect(screen.queryByRole('button', { name: /下移/ })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: '更多操作：《可能的爱》' })
  );
  expect(screen.getByRole('button', { name: /上移/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /下移/ }));
  expect(props.onMove).toHaveBeenCalledWith(props.queue[0], 1);
  fireEvent.click(screen.getByRole('button', { name: /移除/ }));
  expect(props.onRemove).toHaveBeenCalledWith(props.queue[0]);
});

test('an empty list says so and offers to add a film', () => {
  const props = setup({ queue: [] });
  expect(screen.getByText('片单是空的')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /添加影片/ }));
  expect(props.onAdd).toHaveBeenCalled();
});

test('films already played stay folded until opened', () => {
  setup({
    queue: [item('a', '可能的爱'), item('p', '放过的片', { playedAt: 1 })],
  });
  expect(screen.queryByText('放过的片')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /放过的 · 1/ }));
  expect(screen.getByText('放过的片')).toBeInTheDocument();
});

test('members without manage permission only see remove on their own films', () => {
  setup({ canManage: false });
  expect(
    screen.queryByRole('button', { name: '更多操作：《可能的爱》' })
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '更多操作：《蜘蛛侠》' }));
  expect(screen.queryByRole('button', { name: /上移/ })).toBeNull();
  expect(screen.getByRole('button', { name: /移除/ })).toBeInTheDocument();
});
