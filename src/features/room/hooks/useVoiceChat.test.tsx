import { act, cleanup, render } from '@testing-library/react';

import { useVoiceChat } from './useVoiceChat';

type Handler = (data: any) => unknown;
function makeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    id: 'me',
    connected: true,
    emit: jest.fn(),
    on: jest.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    off: jest.fn((event: string) => {
      handlers.delete(event);
    }),
    handlers,
  };
}

class FakePeer {
  static all: FakePeer[] = [];
  closed = false;
  onicecandidate: unknown = null;
  ontrack: unknown = null;
  oniceconnectionstatechange: unknown = null;
  iceConnectionState = 'new';
  constructor() {
    FakePeer.all.push(this);
  }
  addTrack() {
    return undefined;
  }
  async setRemoteDescription() {
    return undefined;
  }
  async setLocalDescription() {
    return undefined;
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async addIceCandidate() {
    return undefined;
  }
  close() {
    this.closed = true;
  }
}
class FakeAudioContext {
  static created = 0;
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudioContext.created += 1;
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    return { connect: jest.fn(), start: jest.fn(), buffer: null };
  }
  close() {
    return undefined;
  }
}

let socket: ReturnType<typeof makeSocket>;
let getUserMedia: jest.Mock;
const VOICE_EVENTS = [
  'voice:offer',
  'voice:answer',
  'voice:ice',
  'voice:mic-enabled',
  'voice:audio-chunk',
];

type Options = Parameters<typeof useVoiceChat>[0];
function setup(overrides: Partial<Options> = {}) {
  const base: Options = {
    socket: socket as unknown as Options['socket'],
    roomId: 'room-a',
    isMicEnabled: false,
    isSpeakerEnabled: true,
    members: [],
    enabled: true,
  };
  function Probe(props: Partial<Options>) {
    useVoiceChat({ ...base, ...overrides, ...props });
    return null;
  }
  const view = render(<Probe />);
  return {
    view,
    update: (props: Partial<Options>) => view.rerender(<Probe {...props} />),
  };
}
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
const registered = () =>
  socket.on.mock.calls
    .map(([event]) => event)
    .filter((event: string) => event.startsWith('voice:'));

beforeEach(() => {
  FakePeer.all = [];
  FakeAudioContext.created = 0;
  socket = makeSocket();
  getUserMedia = jest.fn(async () => ({
    getTracks: () => [{ enabled: true, readyState: 'live', stop: jest.fn() }],
  }));
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  (global as any).RTCPeerConnection = FakePeer;
  (global as any).RTCSessionDescription = class {
    constructor(init: unknown) {
      Object.assign(this, init);
    }
  };
  (global as any).RTCIceCandidate = class {};
  (global as any).AudioContext = FakeAudioContext;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('voice chat that is not opened', () => {
  it('does not listen to any voice event', () => {
    setup({ enabled: false });
    expect(registered()).toEqual([]);
  });

  it('does not ask for the microphone even if a mic switch is on', async () => {
    setup({ enabled: false, isMicEnabled: true });
    await flush();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('a stranger cannot make this device answer a call or play sound', async () => {
    setup({ enabled: false });
    expect(socket.handlers.get('voice:offer')).toBeUndefined();
    expect(socket.handlers.get('voice:audio-chunk')).toBeUndefined();
    expect(FakePeer.all).toHaveLength(0);
    expect(FakeAudioContext.created).toBe(0);
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('voice chat that is opened', () => {
  it('listens to the voice events', () => {
    setup({ enabled: true });
    expect(registered().sort()).toEqual([...VOICE_EVENTS].sort());
  });

  it('answers an offer from a room member', async () => {
    setup({ enabled: true });
    await act(async () => {
      await socket.handlers.get('voice:offer')?.({
        userId: 'peer-1',
        offer: { type: 'offer', sdp: 'x' },
      });
    });
    expect(FakePeer.all).toHaveLength(1);
    expect(socket.emit).toHaveBeenCalledWith(
      'voice:answer',
      expect.objectContaining({ targetUserId: 'peer-1' })
    );
  });

  it('plays relayed audio from others but never its own', async () => {
    setup({ enabled: true });
    const chunk = Array.from(new Uint8Array(64));
    await act(async () => {
      await socket.handlers.get('voice:audio-chunk')?.({
        userId: 'me',
        audioData: chunk,
      });
    });
    expect(FakeAudioContext.created).toBe(0);
    await act(async () => {
      await socket.handlers.get('voice:audio-chunk')?.({
        userId: 'peer-1',
        audioData: chunk,
      });
    });
    expect(FakeAudioContext.created).toBe(1);
  });

  it('asks for the microphone when the mic is switched on', async () => {
    setup({ enabled: true, isMicEnabled: true });
    await flush();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('voice chat that gets closed while running', () => {
  it('hangs up every call and stops listening', async () => {
    const { update } = setup({ enabled: true });
    await act(async () => {
      await socket.handlers.get('voice:offer')?.({
        userId: 'peer-1',
        offer: { type: 'offer', sdp: 'x' },
      });
    });
    expect(FakePeer.all[0].closed).toBe(false);
    update({ enabled: false });
    await flush();
    expect(FakePeer.all[0].closed).toBe(true);
    expect(socket.handlers.size).toBe(0);
  });

  it('opening it later starts listening', () => {
    const { update } = setup({ enabled: false });
    expect(registered()).toEqual([]);
    update({ enabled: true });
    expect(registered().sort()).toEqual([...VOICE_EVENTS].sort());
  });
});
