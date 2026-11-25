import { act, cleanup, render } from '@testing-library/react';

import { useLiveSync } from './useLiveSync';
import { useWebLiveSync } from './useWebLiveSync';

type RoomCommand = jest.Mock<
  Promise<{ success: boolean }>,
  [string, Record<string, unknown>]
>;
interface MockRoom {
  isConnected: boolean;
  isOwner: boolean;
  canControl: boolean;
  changeLiveChannel: jest.Mock;
  roomCommand: RoomCommand;
  socket: { id: string; on: jest.Mock; off: jest.Mock };
  currentRoom: {
    id: string;
    revision: number;
    controllerEpoch: number;
    currentState: object | null;
  };
}
let mockRoom: MockRoom;
let mockSession: Record<string, unknown>;
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/hooks/usePlaybackSession', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));

const direct = {
  type: 'live',
  channelId: 'channel-a',
  channelName: '频道A',
  channelUrl: 'https://media.test/live-a.m3u8',
};
const web = {
  type: 'live',
  channelId: 'source-a',
  channelName: '主播A',
  channelUrl: 'http://localhost/web-live?platform=huya&roomId=123',
};

async function settle(ms = 0) {
  await act(async () => {
    if (ms) jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSession = {};
  mockRoom = {
    isConnected: true,
    isOwner: true,
    canControl: true,
    changeLiveChannel: jest.fn(),
    roomCommand: jest.fn(
      async (_event: string, _payload: Record<string, unknown>) => ({
        success: true,
      })
    ),
    socket: { id: 'device-1', on: jest.fn(), off: jest.fn() },
    currentRoom: {
      id: 'room-a',
      revision: 4,
      controllerEpoch: 2,
      currentState: null,
    },
  };
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe.each(['iptv', 'web'] as const)('%s room live activity', (kind) => {
  function setup() {
    let share: () => Promise<unknown> = async () => {
      throw new Error('the hook has not rendered yet');
    };
    const apply = jest.fn();
    const iptvOptions: Parameters<typeof useLiveSync>[0] = {
      currentChannelId: direct.channelId,
      currentChannelName: direct.channelName,
      currentChannelUrl: direct.channelUrl,
      onChannelChange: apply,
      isReady: () => true,
    };
    const webOptions: Parameters<typeof useWebLiveSync>[0] = {
      currentSourceKey: web.channelId,
      currentSourceName: web.channelName,
      currentSourcePlatform: 'huya',
      currentSourceRoomId: '123',
      onSourceChange: apply,
      isReady: () => true,
    };
    function IptvHarness() {
      share = useLiveSync(iptvOptions).broadcastChannelChange;
      return null;
    }
    function WebHarness() {
      share = useWebLiveSync(webOptions).broadcastSourceChange;
      return null;
    }
    return {
      Harness: kind === 'iptv' ? IptvHarness : WebHarness,
      apply,
      options: kind === 'iptv' ? iptvOptions : webOptions,
      share: () => share(),
      state: kind === 'iptv' ? direct : web,
    };
  }

  it('browsing and new snapshot objects never broadcast the selected local channel', async () => {
    const { Harness } = setup();
    const view = render(<Harness />);
    await settle(1000);
    for (let index = 0; index < 3; index += 1) {
      mockRoom = {
        ...mockRoom,
        currentRoom: { ...mockRoom.currentRoom, revision: 5 + index },
      };
      view.rerender(<Harness />);
      await settle(1000);
    }
    expect(mockRoom.changeLiveChannel).not.toHaveBeenCalled();
    expect(
      mockRoom.roomCommand.mock.calls.filter(
        ([event]) => event === 'live:change'
      )
    ).toHaveLength(0);
  });

  it('explicit share uses current device permission, a canonical ACK, and a target room', async () => {
    const { Harness, share } = setup();
    const view = render(<Harness />);
    mockRoom.canControl = false;
    view.rerender(<Harness />);
    await expect(share()).rejects.toThrow();
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    mockRoom.canControl = true;
    view.rerender(<Harness />);
    await act(async () => {
      await share();
    });
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'live:change',
      expect.objectContaining({ roomId: 'room-a', type: 'live' })
    );
    const reference = String(
      mockRoom.roomCommand.mock.calls.at(-1)?.[1].channelUrl
    );
    expect(new URL(reference).protocol).toMatch(/^https?:$/);
    if (kind === 'web')
      expect(new URL(reference).searchParams.get('roomId')).toBe('123');
  });

  it('applies a joined snapshot even on the owner device without sending it back', async () => {
    const { Harness, apply, state } = setup();
    mockRoom.currentRoom.currentState = state;
    render(<Harness />);
    await settle(1000);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(
      ...(kind === 'iptv'
        ? [state.channelId, state.channelUrl]
        : [state.channelId, 'huya', '123'])
    );
    expect(mockRoom.changeLiveChannel).not.toHaveBeenCalled();
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'room:sync-applied',
      expect.objectContaining({ roomId: 'room-a', appliedRevision: 4 })
    );
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'room:ready',
      expect.objectContaining({ roomId: 'room-a', ready: true })
    );
  });

  it('does not claim readiness until the actual selected stream is ready', async () => {
    const { Harness, options, state } = setup();
    options.isReady = () => false;
    mockRoom.currentRoom.currentState = state;
    const view = render(<Harness />);
    await settle(1000);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    options.isReady = () => true;
    view.rerender(<Harness />);
    await settle(500);
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'room:ready',
      expect.objectContaining({ ready: true })
    );
  });

  it('a pending old-room sync ACK cannot ready a new room', async () => {
    const { Harness, state } = setup();
    let finish: (value: { success: boolean }) => void = () => undefined;
    mockRoom.roomCommand.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    mockRoom.currentRoom.currentState = state;
    const view = render(<Harness />);
    await settle(500);
    mockRoom = {
      ...mockRoom,
      currentRoom: {
        ...mockRoom.currentRoom,
        id: 'room-b',
        currentState: null,
      },
    };
    view.rerender(<Harness />);
    await act(async () => {
      finish({ success: true });
    });
    expect(
      mockRoom.roomCommand.mock.calls.filter(
        ([event]) => event === 'room:ready'
      )
    ).toHaveLength(0);
  });

  it('unrelated room revisions do not reapply a channel or generate another ready cycle', async () => {
    const { Harness, state, apply } = setup();
    mockRoom.currentRoom.currentState = state;
    const view = render(<Harness />);
    await settle(500);
    const commands = mockRoom.roomCommand.mock.calls.length;
    mockRoom = {
      ...mockRoom,
      currentRoom: {
        ...mockRoom.currentRoom,
        revision: 8,
        currentState: { ...state },
      },
    };
    view.rerender(<Harness />);
    await settle(1000);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(mockRoom.roomCommand).toHaveBeenCalledTimes(commands);
  });

  it('a newly connected device acknowledges the current snapshot again', async () => {
    const { Harness, state } = setup();
    mockRoom.currentRoom.currentState = state;
    const view = render(<Harness />);
    await settle(500);
    mockRoom.socket = { ...mockRoom.socket, id: 'device-2' };
    view.rerender(<Harness />);
    await settle(500);
    expect(
      mockRoom.roomCommand.mock.calls.filter(
        ([event]) => event === 'room:ready'
      )
    ).toHaveLength(2);
  });

  it('reentering the same activity after disconnecting requires a fresh ready cycle', async () => {
    const { Harness, state, apply } = setup();
    mockRoom.currentRoom.currentState = state;
    const view = render(<Harness />);
    await settle(500);
    mockRoom.isConnected = false;
    view.rerender(<Harness />);
    await settle(500);
    mockRoom.isConnected = true;
    mockRoom.currentRoom = { ...mockRoom.currentRoom, revision: 10 };
    view.rerender(<Harness />);
    await settle(500);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(
      mockRoom.roomCommand.mock.calls.filter(
        ([event]) => event === 'room:ready'
      )
    ).toHaveLength(2);
  });

  it('a ready local player on a different channel cannot acknowledge the room channel', async () => {
    const { Harness, state } = setup();
    mockRoom.currentRoom.currentState = {
      ...state,
      channelId: 'another-channel',
      channelUrl:
        kind === 'web'
          ? 'https://media.test/web-live?platform=huya&roomId=456'
          : 'https://media.test/another.m3u8',
    };
    render(<Harness />);
    await settle(1000);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  });
});

it.each([
  'huya:123',
  'https://other-origin.test/web-live?roomId=123&platform=huya&unused=1',
])(
  'restores the web source by stable platform/room identity: %s',
  async (reference) => {
    mockRoom.currentRoom.currentState = { ...web, channelUrl: reference };
    const apply = jest.fn();
    function Harness() {
      useWebLiveSync({
        currentSourceKey: 'source-a',
        currentSourceName: '主播A',
        currentSourcePlatform: 'huya',
        currentSourceRoomId: '123',
        onSourceChange: apply,
        isReady: () => true,
      });
      return null;
    }
    render(<Harness />);
    await settle(1000);
    expect(apply).toHaveBeenCalledWith('source-a', 'huya', '123');
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'room:ready',
      expect.objectContaining({ ready: true })
    );
  }
);
