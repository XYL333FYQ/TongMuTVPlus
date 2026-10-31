/** @jest-environment node */
// 房间连接库改为第一次连接时才下载：验证下载期间的并发连接与中途断开。
import type { WatchRoomConfig } from '@/types/watch-room';

const internal: WatchRoomConfig = { enabled: true, serverType: 'internal' };

function fakeSocket() {
  const socket = {
    connected: false,
    active: false,
    on: jest.fn(),
    io: {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      reconnection: jest.fn(),
    },
    // 与真实套接字一致：发起连接后即处于"正在连接"
    connect: jest.fn(() => {
      socket.active = true;
    }),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  return socket;
}

function loadFresh() {
  const io = jest.fn(() => fakeSocket());
  jest.doMock('socket.io-client', () => ({ io }));
  let manager!: typeof import('./watch-room-socket').watchRoomSocketManager;
  jest.isolateModules(() => {
    manager = jest.requireActual<typeof import('./watch-room-socket')>(
      './watch-room-socket'
    ).watchRoomSocketManager;
  });
  return { io, manager };
}

afterEach(() => {
  jest.resetModules();
});

test('下载连接库期间同时发起两次连接，只建立一个连接', async () => {
  const { io, manager } = loadFresh();
  try {
    const [a, b] = await Promise.all([
      manager.connect(internal),
      manager.connect(internal),
    ]);
    expect(a).toBe(b);
    expect(io).toHaveBeenCalledTimes(1);
    expect(a.connect).toHaveBeenCalledTimes(1);
  } finally {
    // 停掉心跳定时器，测试进程才能退出
    manager.disconnect();
  }
});

test('下载连接库期间被断开：不再联网，也不留下常驻连接', async () => {
  const { io, manager } = loadFresh();
  const pending = manager.connect(internal);
  manager.disconnect();
  const socket = await pending;
  expect(manager.getSocket()).toBeNull();
  expect(socket.connect).not.toHaveBeenCalled();
  expect(io).toHaveBeenCalledWith(
    expect.objectContaining({ autoConnect: false })
  );
});
