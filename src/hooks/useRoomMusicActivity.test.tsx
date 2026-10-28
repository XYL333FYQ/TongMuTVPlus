import { act, cleanup, render } from '@testing-library/react';

import { useRoomMusicActivity } from './useRoomMusicActivity';

import type { MusicSyncState } from '@/types/watch-room';

let mockRoom: any;
let mockSession: any;
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));

const song = {
  id: 'song-a',
  name: '歌 A',
  artist: '歌手',
  album: '专辑',
  pic: '',
  platform: 'netease',
  duration: 200,
};
const musicState = (overrides: Partial<MusicSyncState> = {}) =>
  ({
    type: 'music',
    song,
    nextSong: null,
    currentTime: 0,
    isPlaying: true,
    quality: 'standard',
    playMode: 'list',
    updatedAt: 1,
    ...overrides,
  } as MusicSyncState);

function setup() {
  let api!: ReturnType<typeof useRoomMusicActivity>;
  function Probe() {
    api = useRoomMusicActivity();
    return null;
  }
  const view = render(<Probe />);
  return {
    get api() {
      return api;
    },
    view,
    Probe,
  };
}

beforeEach(() => {
  mockSession = {
    followingRoom: true,
    enterPersonalViewing: jest.fn(async () => true),
    controller: { pause: jest.fn(), video: { paused: false } },
  };
  mockRoom = {
    isConnected: true,
    isOwner: true,
    canControl: true,
    roomCommand: jest.fn(async () => ({ success: true })),
    socket: { id: 'device-1' },
    currentRoom: {
      id: 'room-a',
      roomType: 'sync',
      revision: 4,
      controllerEpoch: 2,
      currentState: null,
    },
  };
});
afterEach(cleanup);

describe('room music activity', () => {
  it('is active only while following a room whose current activity is music', () => {
    mockRoom.currentRoom.currentState = musicState();
    const on = setup();
    expect(on.api.active).toBe(true);
    cleanup();

    mockSession.followingRoom = false;
    const alone = setup();
    expect(alone.api.active).toBe(false);
    cleanup();

    mockSession.followingRoom = true;
    mockRoom.currentRoom.currentState = { type: 'play' };
    const film = setup();
    expect(film.api.active).toBe(false);
    cleanup();

    mockRoom = null;
    const none = setup();
    expect(none.api.hasRoom).toBe(false);
    expect(none.api.active).toBe(false);
  });

  it('a regular room can start music: nothing is sent while browsing, only the explicit share sends music:change', async () => {
    const view = setup();
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    view.view.rerender(<view.Probe />);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    const state = musicState();
    await act(async () => view.api.share(state));
    expect(mockRoom.roomCommand).toHaveBeenCalledTimes(1);
    expect(mockRoom.roomCommand).toHaveBeenCalledWith('music:change', {
      ...state,
      roomId: 'room-a',
    });
  });

  it('control belongs to this device, not to the owner account', async () => {
    mockRoom.canControl = false;
    mockRoom.currentRoom.currentState = musicState();
    const view = setup();
    expect(view.api.active).toBe(true);
    expect(view.api.publishing).toBe(false);
    await expect(view.api.share(musicState())).rejects.toThrow(
      '当前设备没有房间播放控制权'
    );
    expect(await view.api.publish('play', musicState())).toBe(false);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  });

  it('a person watching alone can neither share nor be published for', async () => {
    mockSession.followingRoom = false;
    mockRoom.currentRoom.currentState = musicState();
    const view = setup();
    await expect(view.api.share(musicState())).rejects.toThrow('恢复一起看');
    expect(await view.api.publish('seek', musicState())).toBe(false);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  });

  it('publishes progress, play, pause, seek and song changes only once the room is on music and this device controls it', async () => {
    const view = setup();
    expect(await view.api.publish('update', musicState())).toBe(false);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();

    mockRoom.currentRoom = {
      ...mockRoom.currentRoom,
      currentState: musicState(),
    };
    view.view.rerender(<view.Probe />);
    expect(view.api.publishing).toBe(true);
    const next = musicState({ currentTime: 33, isPlaying: false });
    for (const [kind, event] of [
      ['update', 'music:update'],
      ['play', 'music:play'],
      ['pause', 'music:pause'],
      ['seek', 'music:seek'],
      ['change', 'music:change'],
    ] as const) {
      expect(await view.api.publish(kind, next)).toBe(true);
      expect(mockRoom.roomCommand).toHaveBeenLastCalledWith(event, {
        ...next,
        roomId: 'room-a',
      });
    }
  });

  it('a new room snapshot is only an input: it never produces a command by itself', () => {
    mockRoom.currentRoom.currentState = musicState();
    const view = setup();
    mockRoom.currentRoom = {
      ...mockRoom.currentRoom,
      revision: 5,
      currentState: musicState({ currentTime: 50 }),
    };
    view.view.rerender(<view.Probe />);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  });

  it('a rejected room command surfaces its reason instead of being swallowed', async () => {
    mockRoom.roomCommand.mockRejectedValueOnce(new Error('主持权已变更'));
    const view = setup();
    await expect(view.api.share(musicState())).rejects.toThrow('主持权已变更');
  });

  describe('starting local playback', () => {
    it('leaves the room sync and stops the room film before music is heard on this device', async () => {
      mockRoom.currentRoom.currentState = { type: 'play' };
      const view = setup();
      let ok = false;
      await act(async () => {
        ok = await view.api.beginLocalPlayback();
      });
      expect(ok).toBe(true);
      expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(1);
      expect(mockSession.controller.pause).toHaveBeenCalledTimes(1);
    });

    it('does not leave the sync while this device is publishing the room music', async () => {
      mockRoom.currentRoom.currentState = musicState();
      const view = setup();
      await act(async () => {
        await view.api.beginLocalPlayback();
      });
      expect(mockSession.enterPersonalViewing).not.toHaveBeenCalled();
    });

    it('stops without changing anything when the room sync cannot be left', async () => {
      mockRoom.currentRoom.currentState = { type: 'play' };
      mockSession.enterPersonalViewing.mockResolvedValueOnce(false);
      const view = setup();
      let ok = true;
      await act(async () => {
        ok = await view.api.beginLocalPlayback();
      });
      expect(ok).toBe(false);
      expect(mockSession.controller.pause).not.toHaveBeenCalled();
    });

    it('outside a room it only makes sure a playing film is not heard together with the music', async () => {
      mockRoom = null;
      const view = setup();
      let ok = false;
      await act(async () => {
        ok = await view.api.beginLocalPlayback();
      });
      expect(ok).toBe(true);
      expect(mockSession.enterPersonalViewing).not.toHaveBeenCalled();
      expect(mockSession.controller.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('publish ordering', () => {
    it('sends the next command only after the previous one is acknowledged, so it carries the room version the first one produced', async () => {
      mockRoom.currentRoom.currentState = musicState();
      let release!: () => void;
      mockRoom.roomCommand.mockImplementationOnce(
        () => new Promise<void>((done) => (release = done))
      );
      const view = setup();
      let first!: Promise<boolean>;
      let second!: Promise<boolean>;
      await act(async () => {
        first = view.api.publish('change', musicState());
        second = view.api.publish('update', musicState());
        await Promise.resolve();
      });
      expect(mockRoom.roomCommand).toHaveBeenCalledTimes(1);
      await act(async () => {
        release();
        await first;
        await second;
      });
      expect(mockRoom.roomCommand).toHaveBeenCalledTimes(2);
      expect(
        mockRoom.roomCommand.mock.calls.map((call: any[]) => call[0])
      ).toEqual(['music:change', 'music:update']);
    });

    it('a rejected command does not block the ones after it', async () => {
      mockRoom.currentRoom.currentState = musicState();
      mockRoom.roomCommand.mockRejectedValueOnce(new Error('版本已更新'));
      const view = setup();
      let first!: Promise<boolean>;
      let second!: Promise<boolean>;
      await act(async () => {
        first = view.api.publish('change', musicState());
        first.catch(() => undefined);
        second = view.api.publish('update', musicState());
        await Promise.resolve();
      });
      await expect(first).rejects.toThrow('版本已更新');
      await act(async () => {
        await second;
      });
      expect(mockRoom.roomCommand).toHaveBeenCalledTimes(2);
    });
  });
});
