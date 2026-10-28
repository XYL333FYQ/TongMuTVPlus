import { act, cleanup, render } from '@testing-library/react';

import { useScreenShare } from './useScreenShare';

let mockRoom: any;
let mockSession: any;
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => mockSession,
}));

class FakeTrack {
  stopped = false;
  onended: (() => void) | null = null;
  kind: string;
  constructor(kind: string) {
    this.kind = kind;
  }
  stop() {
    this.stopped = true;
  }
  getSettings() {
    return { width: 1280, height: 720, frameRate: 15 };
  }
}
class FakeStream {
  tracks = [new FakeTrack('video'), new FakeTrack('audio')];
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio');
  }
}
class FakePeer {
  static all: FakePeer[] = [];
  onicecandidate: unknown = null;
  ontrack: unknown = null;
  closed = false;
  constructor() {
    FakePeer.all.push(this);
  }
  addTrack() {
    return undefined;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }
  async setLocalDescription() {
    return undefined;
  }
  async setRemoteDescription() {
    return undefined;
  }
  async addIceCandidate() {
    return undefined;
  }
  close() {
    this.closed = true;
  }
}

let streams: FakeStream[];
let getDisplayMedia: jest.Mock;
let api: ReturnType<typeof useScreenShare>;
function Probe() {
  api = useScreenShare('smooth');
  return null;
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
const screenState = (status: 'sharing' | 'idle' = 'sharing') => ({
  type: 'screen',
  status,
  ownerName: 'alice',
  hasAudio: true,
  startedAt: 1,
});

beforeEach(() => {
  FakePeer.all = [];
  streams = [];
  getDisplayMedia = jest.fn(async () => {
    const stream = new FakeStream();
    streams.push(stream);
    return stream;
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia },
  });
  (global as any).RTCPeerConnection = FakePeer;
  (global as any).RTCSessionDescription = class {
    constructor(init: unknown) {
      Object.assign(this, init);
    }
  };
  (global as any).RTCIceCandidate = class {
    constructor(init: unknown) {
      Object.assign(this, init);
    }
  };
  mockSession = { followingRoom: true };
  mockRoom = {
    isConnected: true,
    isOwner: false,
    canControl: true,
    roomCommand: jest.fn(async () => ({ success: true })),
    startScreenShare: jest.fn(),
    stopScreenShare: jest.fn(),
    members: [
      { id: 'device-1', name: 'alice', isOwner: false },
      { id: 'device-2', name: 'bob', isOwner: false },
      { id: 'device-3', name: 'carol', isOwner: false },
    ],
    socket: {
      id: 'device-1',
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    },
    currentRoom: {
      id: 'room-a',
      roomType: 'sync',
      ownerName: 'alice',
      revision: 3,
      currentState: null,
    },
  };
});
afterEach(cleanup);

const emitted = (event: string) =>
  mockRoom.socket.emit.mock.calls.filter(([name]: [string]) => name === event);
const handler = (event: string) =>
  mockRoom.socket.on.mock.calls.find(([name]: [string]) => name === event)?.[1];

describe('screen sharing in a regular room', () => {
  it('a controlling device in a regular room can share: the capture is confirmed by the room before anyone is offered the picture', async () => {
    render(<Probe />);
    await act(async () => api.startSharing());
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(mockRoom.roomCommand).toHaveBeenCalledTimes(1);
    expect(mockRoom.roomCommand).toHaveBeenCalledWith(
      'screen:start',
      expect.objectContaining({
        type: 'screen',
        status: 'sharing',
        roomId: 'room-a',
        hasAudio: true,
      })
    );
    // 只给自己以外的设备发画面，同账号的其他设备也是观众
    const targets = emitted('screen:offer').map(
      ([, data]: [string, { targetUserId: string }]) => data.targetUserId
    );
    expect(targets.sort()).toEqual(['device-2', 'device-3']);
    expect(api.isLocalSharing).toBe(true);
  });

  it('a preview element that mounts after the capture started still shows the capture', async () => {
    // 刷新后重新开始共享：页面此时渲染的是远端画面，本地预览元素要等 isLocalSharing 变化后才挂载
    const view = render(<Probe />);
    await act(async () => api.startSharing());
    const preview = document.createElement('video');
    (api.localVideoRef as { current: HTMLVideoElement | null }).current =
      preview;
    view.rerender(<Probe />);
    expect(preview.srcObject).toBe(streams[0]);
  });

  it('control belongs to this device: the owner account on a device without control is not even asked to pick a screen', async () => {
    mockRoom.isOwner = true;
    mockRoom.canControl = false;
    render(<Probe />);
    await act(async () => api.startSharing());
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    expect(api.error).toBe('当前设备没有房间播放控制权');
  });

  it('a person watching alone cannot share', async () => {
    mockSession.followingRoom = false;
    render(<Probe />);
    await act(async () => api.startSharing());
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(api.error).toContain('恢复一起看');
  });

  it('when the room refuses the start, the capture is released and nobody is offered anything', async () => {
    mockRoom.roomCommand.mockRejectedValueOnce(new Error('主持权已变更'));
    render(<Probe />);
    await act(async () => api.startSharing());
    expect(streams[0].tracks.every((track) => track.stopped)).toBe(true);
    expect(emitted('screen:offer')).toHaveLength(0);
    expect(api.error).toBe('主持权已变更');
    expect(api.isLocalSharing).toBe(false);
  });

  it('a screen picked after the room has changed is discarded instead of being shared into the new room', async () => {
    let pick: (stream: FakeStream) => void = () => undefined;
    getDisplayMedia.mockImplementationOnce(
      () =>
        new Promise<FakeStream>((resolve) => {
          pick = resolve;
        })
    );
    const view = render(<Probe />);
    let starting: Promise<void> | undefined;
    act(() => {
      starting = api.startSharing();
    });
    mockRoom = {
      ...mockRoom,
      currentRoom: { ...mockRoom.currentRoom, id: 'room-b' },
    };
    view.rerender(<Probe />);
    const stream = new FakeStream();
    await act(async () => {
      pick(stream);
      await starting;
    });
    expect(stream.tracks.every((track) => track.stopped)).toBe(true);
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
    expect(api.isLocalSharing).toBe(false);
  });

  it('stopping releases the capture and tells the room through a confirmed command, not by account ownership', async () => {
    render(<Probe />);
    await act(async () => api.startSharing());
    mockRoom.roomCommand.mockClear();
    await act(async () => api.stopSharing(true));
    expect(streams[0].tracks.every((track) => track.stopped)).toBe(true);
    expect(mockRoom.roomCommand).toHaveBeenCalledWith('screen:stop', {
      roomId: 'room-a',
    });
    expect(api.isLocalSharing).toBe(false);
  });

  it('the capture is released when the room stops being a screen share', async () => {
    const view = render(<Probe />);
    await act(async () => api.startSharing());
    mockRoom = {
      ...mockRoom,
      currentRoom: { ...mockRoom.currentRoom, currentState: screenState() },
    };
    view.rerender(<Probe />);
    await settle();
    expect(streams[0].tracks.some((track) => track.stopped)).toBe(false);
    mockRoom = {
      ...mockRoom,
      currentRoom: { ...mockRoom.currentRoom, currentState: null },
    };
    view.rerender(<Probe />);
    await settle();
    expect(streams[0].tracks.every((track) => track.stopped)).toBe(true);
    expect(api.isLocalSharing).toBe(false);
  });
});

describe('a share left behind by a reload', () => {
  it('the controlling device that is not capturing can still end the share', async () => {
    mockRoom.currentRoom.currentState = screenState();
    render(<Probe />);
    expect(api.isLocalSharing).toBe(false);
    await act(async () => api.stopSharing(true));
    expect(mockRoom.roomCommand).toHaveBeenCalledWith('screen:stop', {
      roomId: 'room-a',
    });
  });

  it('a device without control never ends someone else share', async () => {
    mockRoom.canControl = false;
    mockRoom.currentRoom.currentState = screenState();
    render(<Probe />);
    await act(async () => api.stopSharing(true));
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  });

  it('with no share running there is nothing to end', async () => {
    render(<Probe />);
    await act(async () => api.stopSharing(true));
    expect(mockRoom.roomCommand).not.toHaveBeenCalled();
  });
});

describe('watching a screen share', () => {
  beforeEach(() => {
    mockRoom.canControl = false;
    mockRoom.currentRoom.currentState = screenState();
  });

  it('asks the sharing device for the picture once the room is sharing', () => {
    render(<Probe />);
    expect(emitted('screen:viewer-ready')).toHaveLength(1);
  });

  it('does not ask for the picture while watching alone', () => {
    mockSession.followingRoom = false;
    render(<Probe />);
    expect(emitted('screen:viewer-ready')).toHaveLength(0);
  });

  it('the owner account on another device is a viewer too and answers the offer', async () => {
    mockRoom.isOwner = true;
    render(<Probe />);
    await act(async () =>
      handler('screen:offer')({
        userId: 'device-9',
        offer: { type: 'offer', sdp: 'x' },
      })
    );
    expect(emitted('screen:answer')).toHaveLength(1);
    expect(emitted('screen:answer')[0][1].targetUserId).toBe('device-9');
  });
});
