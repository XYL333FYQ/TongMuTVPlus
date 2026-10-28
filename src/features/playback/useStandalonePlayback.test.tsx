import { act, cleanup, render } from '@testing-library/react';

import { useStandalonePlayback } from './useStandalonePlayback';

let mockRoom: any;
let mockSession: any;
const mockClaimSound = jest.fn();
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));
jest.mock('@/features/playback/useAudioFocus', () => ({
  useAudioFocus: () => ({ ownsSound: true, claimSound: mockClaimSound }),
}));

let api: ReturnType<typeof useStandalonePlayback>;
function Probe() {
  api = useStandalonePlayback();
  return null;
}
const settleRetries = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  mockClaimSound.mockClear();
  mockRoom = { currentRoom: { id: 'room-a' } };
  mockSession = {
    followingRoom: true,
    controller: { pause: jest.fn() },
    enterPersonalViewing: jest.fn(async () => {
      mockSession.followingRoom = false;
      return true;
    }),
  };
});
afterEach(cleanup);

describe('a standalone player (TV) next to a room', () => {
  it('leaves the shared viewing before the player may load, then stops the room film', async () => {
    const view = render(<Probe />);
    expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(1);
    expect(api.ready).toBe(false);
    await flush();
    view.rerender(<Probe />);
    expect(api.ready).toBe(true);
    expect(api.error).toBeNull();
    expect(mockSession.controller.pause).toHaveBeenCalledTimes(1);
  });

  it('does not touch the room when there is no room', () => {
    mockRoom = { currentRoom: null };
    render(<Probe />);
    expect(api.ready).toBe(true);
    expect(mockSession.enterPersonalViewing).not.toHaveBeenCalled();
  });

  it('does not touch the room when this device already watches alone', () => {
    mockSession.followingRoom = false;
    render(<Probe />);
    expect(api.ready).toBe(true);
    expect(mockSession.enterPersonalViewing).not.toHaveBeenCalled();
    expect(mockSession.controller.pause).not.toHaveBeenCalled();
  });

  it('works without any room or playback provider', () => {
    mockRoom = null;
    mockSession = null;
    render(<Probe />);
    expect(api.ready).toBe(true);
  });

  it('an exit that fails for good keeps the player from loading, says so, and can be retried by hand', async () => {
    mockSession.enterPersonalViewing.mockResolvedValue(false);
    const view = render(<Probe />);
    await settleRetries();
    view.rerender(<Probe />);
    expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(3);
    expect(api.ready).toBe(false);
    expect(api.error).toBe('未能退出共同播放，请重试');
    expect(mockSession.controller.pause).not.toHaveBeenCalled();
    mockSession.enterPersonalViewing.mockImplementation(async () => {
      mockSession.followingRoom = false;
      return true;
    });
    act(() => api.retry());
    await flush();
    view.rerender(<Probe />);
    expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(4);
    expect(api.error).toBeNull();
    expect(api.ready).toBe(true);
  });

  it('a thrown exit is reported the same way instead of crashing the page', async () => {
    mockSession.enterPersonalViewing.mockRejectedValue(new Error('boom'));
    const view = render(<Probe />);
    await settleRetries();
    view.rerender(<Probe />);
    expect(api.ready).toBe(false);
    expect(api.error).toBe('未能退出共同播放，请重试');
  });

  it('an exit that was overtaken by the room joining at page load is simply tried again', async () => {
    // 页面一加载就自动退出时，房间刚好加入完成，会话层随后重置了“跟随”状态，
    // 第一次退出会被判为已被取代（返回 false）。这不是真失败，应自动再试
    mockSession.enterPersonalViewing.mockResolvedValueOnce(false);
    const view = render(<Probe />);
    await settleRetries();
    view.rerender(<Probe />);
    expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(2);
    expect(api.error).toBeNull();
    expect(api.ready).toBe(true);
    expect(mockSession.controller.pause).toHaveBeenCalledTimes(1);
  });

  it('stops retrying once the page is gone', async () => {
    mockSession.enterPersonalViewing.mockResolvedValue(false);
    const view = render(<Probe />);
    await flush();
    view.unmount();
    await settleRetries();
    expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(1);
  });

  it('an answer that arrives after the room changed is ignored', async () => {
    let finish: (ok: boolean) => void = () => undefined;
    mockSession.enterPersonalViewing.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
    );
    // 新房间的退出请求单独处理（这里让它失败，只观察旧房间迟到的成功）
    mockSession.enterPersonalViewing.mockResolvedValueOnce(false);
    const view = render(<Probe />);
    mockRoom = { currentRoom: { id: 'room-b' } };
    view.rerender(<Probe />);
    await act(async () => {
      finish(true);
    });
    expect(mockSession.enterPersonalViewing).toHaveBeenCalledTimes(2);
    expect(mockSession.controller.pause).not.toHaveBeenCalled();
  });

  it('an answer that arrives after the page is gone is ignored', async () => {
    let finish: (ok: boolean) => void = () => undefined;
    mockSession.enterPersonalViewing.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
    );
    const view = render(<Probe />);
    view.unmount();
    await act(async () => {
      finish(true);
    });
    expect(mockSession.controller.pause).not.toHaveBeenCalled();
  });

  it('takes the sound only when the video really plays', () => {
    mockRoom = { currentRoom: null };
    render(<Probe />);
    const video = document.createElement('video');
    act(() => api.bindVideo(video));
    expect(mockClaimSound).not.toHaveBeenCalled();
    act(() => {
      video.dispatchEvent(new Event('play'));
    });
    expect(mockClaimSound).toHaveBeenCalledTimes(1);
  });

  it('a video that already started before it was handed over still takes the sound', () => {
    mockRoom = { currentRoom: null };
    render(<Probe />);
    const video = document.createElement('video');
    Object.defineProperty(video, 'paused', { value: false });
    act(() => api.bindVideo(video));
    expect(mockClaimSound).toHaveBeenCalledTimes(1);
  });

  it('a video that is still paused does not take the sound by being handed over', () => {
    mockRoom = { currentRoom: null };
    render(<Probe />);
    const video = document.createElement('video');
    act(() => api.bindVideo(video));
    expect(mockClaimSound).not.toHaveBeenCalled();
  });

  it('stops listening to a video that was replaced', () => {
    mockRoom = { currentRoom: null };
    render(<Probe />);
    const first = document.createElement('video');
    const second = document.createElement('video');
    act(() => api.bindVideo(first));
    act(() => api.bindVideo(second));
    act(() => {
      first.dispatchEvent(new Event('play'));
    });
    expect(mockClaimSound).not.toHaveBeenCalled();
    act(() => {
      second.dispatchEvent(new Event('play'));
    });
    expect(mockClaimSound).toHaveBeenCalledTimes(1);
  });
});
