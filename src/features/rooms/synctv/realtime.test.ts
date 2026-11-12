import { RoomRealtimeClient } from './realtime';
import { synctv } from './protocol/client';
class Socket extends EventTarget {
  readyState = 0;
  binaryType = '';
  send = jest.fn();
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  receive(value: synctv.client.IServerMessage) {
    const bytes = synctv.client.ServerMessage.encode(value).finish();
    const data = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(data).set(bytes);
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
function fixture() {
  const sockets: Socket[] = [];
  const ticket = jest.fn(async () => ({
    ticket: 'single-' + sockets.length,
    roomId: 'room_one',
  }));
  const onMessage = jest.fn();
  const client = new RoomRealtimeClient('room_one', {
    origin: 'http://localhost',
    ticket,
    socket: () => {
      const socket = new Socket();
      sockets.push(socket);
      return socket as never;
    },
    onMessage,
    random: () => 0,
  });
  return { sockets, ticket, client, onMessage };
}
test('fresh tickets and protobuf subscriptions replay after reconnect, preserving int64 cursors', async () => {
  const f = fixture();
  f.client.observe({ observeId: 'chat', chatEvents: {}, deliveryMode: 2 });
  f.client.start();
  await flush();
  f.sockets[0].open();
  f.sockets[0].receive({
    resourceEvent: {
      observeId: 'chat',
      eventCursor: { sequence: '9007199254740993' as never },
    },
  });
  f.sockets[0].close();
  jest.advanceTimersByTime(500);
  await flush();
  f.sockets[1].open();
  expect(f.ticket).toHaveBeenCalledTimes(2);
  const sent = f.sockets[1].send.mock.calls.map((args) =>
    synctv.client.ClientMessage.decode(args[0])
  );
  expect(
    sent
      .find((item) => item.observeResource)
      ?.observeResource?.chatEvents?.afterEventSequence?.toString()
  ).toBe('9007199254740993');
  f.client.stop();
});
test('server termination and stop prevent reconnect and ignore late messages', async () => {
  const f = fixture();
  f.client.start();
  await flush();
  f.sockets[0].open();
  f.sockets[0].receive({ termination: { code: 2, message: 'revoked' } });
  const count = f.onMessage.mock.calls.length;
  f.sockets[0].receive({ heartbeatAck: { timestamp: 10 } });
  jest.advanceTimersByTime(60000);
  await flush();
  expect(f.ticket).toHaveBeenCalledTimes(1);
  expect(f.onMessage).toHaveBeenCalledTimes(count);
});
test('stop cancels late ticket acquisition and disconnected commands never queue', async () => {
  const f = fixture();
  f.client.start();
  f.client.stop();
  await flush();
  expect(f.sockets).toHaveLength(0);
  expect(() => f.client.send({ playbackStateUpdate: { type: 1 } })).toThrow();
});
