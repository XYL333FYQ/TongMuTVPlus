import { TogetherRoomSession } from './session';
import { synctv } from './protocol/client';
const mockClients: {
  options: {
    onMessage: (message: synctv.client.IServerMessage) => void;
    onStatus: (status: string) => void;
  };
  start: jest.Mock;
  stop: jest.Mock;
  observe: jest.Mock;
  send: jest.Mock;
}[] = [];
jest.mock('./realtime', () => ({
  RoomRealtimeClient: class {
    start = jest.fn();
    stop = jest.fn();
    observe = jest.fn();
    send = jest.fn();
    constructor(
      _roomId: string,
      readonly options: (typeof mockClients)[number]['options']
    ) {
      mockClients.push(this);
    }
  },
}));
beforeEach(() => {
  jest.useFakeTimers();
  mockClients.length = 0;
});
afterEach(() => jest.useRealTimers());
test('a room session observes authoritative resources and tears down all loops and sockets', async () => {
  const api = { request: jest.fn(), syncClock: jest.fn(), ticket: jest.fn() };
  const port = {
    subscribe: () => jest.fn(),
    read: () => ({ ready: false }),
    pause: jest.fn(),
  };
  const session = new TogetherRoomSession('room_one', {
    api: api as never,
    port: port as never,
    selectMedia: jest.fn(),
    duration: () => 100,
    onChange: jest.fn(),
    onError: jest.fn(),
    origin: 'http://localhost',
  });
  session.start();
  expect(mockClients[0].observe).toHaveBeenCalledWith(
    expect.objectContaining({ observeId: 'playback_state', playbackState: {} })
  );
  mockClients[0].options.onStatus('connected');
  expect(api.syncClock).toHaveBeenCalledTimes(1);
  await session.leave();
  expect(api.request).toHaveBeenCalledWith(
    '/rooms/room_one/membership',
    expect.objectContaining({ method: 'DELETE' })
  );
  expect(mockClients[0].stop).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
test('server termination disposes the adapter, records the state and stops recovery loops', () => {
  const onChange = jest.fn();
  const session = new TogetherRoomSession('room_one', {
    api: { syncClock: jest.fn() } as never,
    port: { subscribe: () => jest.fn() } as never,
    selectMedia: jest.fn(),
    duration: () => 100,
    onChange,
    onError: jest.fn(),
    origin: 'http://localhost',
  });
  session.start();
  mockClients[0].options.onStatus('terminated');
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'terminated' })
  );
  expect(jest.getTimerCount()).toBe(0);
  session.dispose();
});
