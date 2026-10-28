jest.mock('next/navigation', () => ({
  useSearchParams: () => mockParams,
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => mockRoom,
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import { act, fireEvent, render, screen } from '@testing-library/react';

import RoomFilmSelection from './RoomFilmSelection';

const film = '/play?source=fixture&id=next&title=下一部&episode=1';
let mockParams = new URLSearchParams();
const makeRoom = () => ({
  currentRoom: { id: 'room-a', name: '朋友的房间' },
  isConnected: true,
  roomCommand: jest.fn<Promise<unknown>, [string, Record<string, unknown>]>(
    () => Promise.resolve({ success: true })
  ),
});
let mockRoom = makeRoom();

beforeEach(() => {
  mockRoom = makeRoom();
  mockParams = new URLSearchParams({ room: 'room-a', film });
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID: () => 'queue-operation-id' },
  });
});

test('the selection page waits for confirmation and offers a return to the same room', async () => {
  let confirm!: () => void;
  mockRoom.roomCommand.mockReturnValueOnce(
    new Promise<void>((done) => {
      confirm = done;
    })
  );
  render(<RoomFilmSelection />);
  expect(screen.getByRole('heading', { name: '添加待看' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '将下一部加入待看' }));
  expect(screen.queryByText(/已加入待看片单/)).not.toBeInTheDocument();
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'queue:add',
    expect.objectContaining({
      roomId: 'room-a',
      source: 'fixture',
      videoId: 'next',
      episode: 1,
    })
  );
  await act(async () => confirm());
  expect(screen.getByRole('status')).toHaveTextContent('已加入待看片单');
  expect(screen.getByRole('link', { name: '返回房间' })).toHaveAttribute(
    'href',
    '/watch-room?room=room-a'
  );
  expect(screen.getByRole('button', { name: '继续选片' })).toBeInTheDocument();
});

test('a target room mismatch never adds the selected movie to a different room', () => {
  mockRoom.currentRoom.id = 'room-b';
  render(<RoomFilmSelection />);
  expect(screen.getByRole('alert')).toHaveTextContent('目标房间已变化');
  expect(
    screen.queryByRole('button', { name: '将下一部加入待看' })
  ).not.toBeInTheDocument();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});

test('a former room confirmation cannot show success in the new room', async () => {
  let confirm!: () => void;
  mockRoom.roomCommand.mockReturnValueOnce(
    new Promise<void>((done) => {
      confirm = done;
    })
  );
  const view = render(<RoomFilmSelection />);
  fireEvent.click(screen.getByRole('button', { name: '将下一部加入待看' }));
  mockRoom = makeRoom();
  mockRoom.currentRoom.id = 'room-b';
  view.rerender(<RoomFilmSelection />);
  await act(async () => confirm());
  expect(screen.queryByText(/已加入待看片单/)).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('目标房间已变化');
});
