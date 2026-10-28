import { act, fireEvent, render, screen } from '@testing-library/react';

import RoomActivityActions from './RoomActivityActions';

let mockRoom: any;
let mockSession: any;
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('./context', () => ({ usePlaybackSessionSafe: () => mockSession }));

beforeEach(() => {
  mockRoom = {
    isConnected: true,
    canControl: true,
    currentRoom: { id: 'room-a' },
    createRoom: jest.fn(),
  };
  mockSession = {
    followingRoom: true,
    resumeRoom: jest.fn(async () => undefined),
    enterPersonalViewing: jest.fn(async () => undefined),
  };
});

it('requires an explicit share action and only shows success after its ACK', async () => {
  let finish: () => void = () => undefined;
  const share = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active={false}
      hasSelection
      onShare={share}
    />
  );
  expect(share).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '在房间播放' }));
  expect(share).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('已在房间共享')).toBeNull();
  await act(async () => finish());
  expect(screen.getByRole('status')).toHaveTextContent('已在房间共享');
});

it('does not substitute account ownership for current-device control', () => {
  mockRoom.canControl = false;
  mockRoom.isOwner = true;
  const share = jest.fn();
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active
      hasSelection
      onShare={share}
    />
  );
  expect(screen.getByRole('button', { name: '在房间播放' })).toBeDisabled();
  expect(screen.getByText('仅当前主持设备可切换房间活动')).toBeInTheDocument();
  expect(share).not.toHaveBeenCalled();
});

it('personal mode offers explicit resume, never shares as a side effect of resuming', async () => {
  mockSession.followingRoom = false;
  const share = jest.fn();
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active={false}
      hasSelection
      onShare={share}
    />
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '恢复一起看' }))
  );
  expect(mockSession.resumeRoom).toHaveBeenCalledTimes(1);
  expect(share).not.toHaveBeenCalled();
});

it('uses the existing personal-viewing transition to leave a shared activity', async () => {
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active
      hasSelection
      onShare={jest.fn()}
    />
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '仅自己看' }))
  );
  expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(1);
});

it('preserves errors for retry without a false success or navigation', async () => {
  const share = jest
    .fn()
    .mockRejectedValueOnce(new Error('连接已断开'))
    .mockResolvedValueOnce(undefined);
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active
      hasSelection
      onShare={share}
    />
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '在房间播放' }))
  );
  expect(screen.getByRole('status')).toHaveTextContent('连接已断开');
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '在房间播放' }))
  );
  expect(screen.getByRole('status')).toHaveTextContent('已在房间共享');
});

it.each(['room', 'selection'])(
  'an obsolete %s ACK does not write success into the new action scope',
  async (change) => {
    let finish: () => void = () => undefined;
    const share = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const view = render(
      <RoomActivityActions
        title='频道A'
        selectionKey='a'
        active
        hasSelection
        onShare={share}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '在房间播放' }));
    if (change === 'room')
      mockRoom = { ...mockRoom, currentRoom: { id: 'room-b' } };
    view.rerender(
      <RoomActivityActions
        title='频道B'
        selectionKey={change === 'selection' ? 'b' : 'a'}
        active
        hasSelection
        onShare={share}
      />
    );
    await act(async () => finish());
    expect(screen.queryByText('已在房间共享')).toBeNull();
    expect(
      screen.getByRole('button', { name: '在房间播放' })
    ).not.toBeDisabled();
  }
);

it('without membership links to room creation while keeping the selected page available', () => {
  mockRoom.currentRoom = null;
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active={false}
      hasSelection
      onShare={jest.fn()}
    />
  );
  expect(screen.getByRole('link', { name: '创建或加入房间' })).toHaveAttribute(
    'href',
    expect.stringContaining('/watch-room')
  );
});

it('sound ownership changes only through the explicit sound action', async () => {
  const sound = jest.fn(async () => undefined);
  render(
    <RoomActivityActions
      title='频道A'
      selectionKey='a'
      active={false}
      hasSelection
      onShare={jest.fn()}
      soundBlocked
      onSound={sound}
    />
  );
  expect(sound).not.toHaveBeenCalled();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '在此页播放声音' }))
  );
  expect(sound).toHaveBeenCalledTimes(1);
});
