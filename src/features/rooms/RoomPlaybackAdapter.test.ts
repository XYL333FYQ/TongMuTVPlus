import { RoomPlaybackAdapter } from './RoomPlaybackAdapter';
import type { PlaybackEvent, PlaybackPort } from '@/features/playback/port';
function fixture() {
  let listener: (event: PlaybackEvent) => void = () => undefined;
  const port = {
    read: () => ({
      ready: true,
      currentTime: 0,
      playing: false,
      playbackRate: 1,
    }),
    seek: jest.fn(),
    setRate: jest.fn(),
    play: jest.fn(async () => undefined),
    pause: jest.fn(),
    subscribe: (callback: typeof listener) => {
      listener = callback;
      return jest.fn();
    },
    load: jest.fn(),
  };
  const send = jest.fn(),
    select = jest.fn(
      async (_id: string, _signal: AbortSignal): Promise<void> => undefined
    );
  const adapter = new RoomPlaybackAdapter('room_one', port as PlaybackPort, {
    send,
    selectMedia: select,
    now: () => 10000,
    duration: () => 100,
    uuid: () => 'operation-id',
    onError: jest.fn(),
  });
  return {
    adapter,
    port,
    send,
    select,
    emit: (origin: 'local' | 'remote') =>
      listener({
        type: 'seeked',
        origin,
        state: { ready: true, currentTime: 20, playing: true, playbackRate: 1 },
      }),
  };
}
const state = {
  roomId: 'room_one',
  playingMediaId: 'med_one',
  playingPlaylistId: '',
  targetHash: '',
  position: 5,
  speed: 1.5,
  isPlaying: true,
  version: 1,
  generatedAtMillis: 8000,
};
test('server state derives corrected position with clock, applies rate and never broadcasts remote events', async () => {
  const f = fixture();
  await f.adapter.receive(state);
  f.emit('remote');
  expect(f.port.seek).toHaveBeenCalledWith(8, 'remote');
  expect(f.port.setRate).toHaveBeenCalledWith(1.5, 'remote');
  expect(f.port.play).toHaveBeenCalledWith('remote');
  expect(f.send).not.toHaveBeenCalled();
  f.adapter.dispose();
});
test('personal viewing is isolated until follow resumes, including while a media load is pending', async () => {
  const f = fixture();
  f.adapter.follow(false);
  await f.adapter.receive(state);
  expect(f.select).not.toHaveBeenCalled();
  expect(f.port.seek).not.toHaveBeenCalled();
  await f.adapter.follow(true);
  expect(f.select).toHaveBeenCalledWith('med_one', expect.anything());
  f.adapter.dispose();
});
test('permission checks prevent member control; authorized commands carry media guards without stale version locks', async () => {
  const f = fixture();
  await f.adapter.receive(state);
  f.emit('local');
  expect(f.send).not.toHaveBeenCalled();
  f.adapter.permissions(true);
  f.emit('local');
  expect(f.send).toHaveBeenCalledWith({
    playbackStateUpdate: expect.objectContaining({
      type: 3,
      position: 20,
      expectedMediaId: 'med_one',
      expectedPlaylistId: '',
      expectedTargetHash: '',
      clientOperationId: 'operation-id',
    }),
  });
  expect(f.send.mock.calls[0][0].playbackStateUpdate).not.toHaveProperty(
    'version'
  );
  f.adapter.dispose();
});
test('old room or older version cannot replace current playback, and live playback never seeks', async () => {
  const f = fixture();
  await f.adapter.receive({ ...state, version: 2 });
  f.port.seek.mockClear();
  await f.adapter.receive(state);
  await f.adapter.receive({ ...state, roomId: 'room_other', version: 10 });
  expect(f.port.seek).not.toHaveBeenCalled();
  f.adapter.live(true);
  await f.adapter.receive({ ...state, version: 3 });
  expect(f.port.seek).not.toHaveBeenCalled();
  f.adapter.dispose();
});
test('detaching aborts pending media selection and clearing shared playback pauses only a follower', async () => {
  const f = fixture();
  let signal: AbortSignal | undefined;
  let finish: () => void = () => undefined;
  f.select.mockImplementationOnce((_id: string, cancellation?: AbortSignal) => {
    signal = cancellation;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const loading = f.adapter.receive(state);
  await Promise.resolve();
  await f.adapter.correct();
  expect(signal?.aborted).toBe(false);
  expect(f.select).toHaveBeenCalledTimes(1);
  await f.adapter.follow(false);
  expect(signal?.aborted).toBe(true);
  finish();
  await loading;
  expect(f.port.play).not.toHaveBeenCalled();
  await f.adapter.follow(true);
  f.port.pause.mockClear();
  await f.adapter.receive({ ...state, playingMediaId: '', version: 2 });
  expect(f.port.pause).toHaveBeenCalledWith('remote');
  f.adapter.dispose();
});
