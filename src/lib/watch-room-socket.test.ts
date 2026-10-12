/** @jest-environment node */
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';

import {
  type WatchRoomSocket,
  watchRoomSocketManager,
} from '@/lib/watch-room-socket';

import type { WatchRoomConfig } from '@/types/watch-room';

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

type Listener = (value?: unknown) => void;
class MockEmitter {
  handlers = new Map<string, Set<Listener>>();
  on(event: string, handler: Listener) {
    const handlers = this.handlers.get(event) || new Set<Listener>();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return this;
  }
  off(event: string, handler: Listener) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
  deliver(event: string, value?: unknown) {
    Array.from(this.handlers.get(event) || []).forEach((handler) =>
      handler(value)
    );
  }
  count(event: string) {
    return this.handlers.get(event)?.size || 0;
  }
}
class MockSocket extends MockEmitter {
  active = false;
  connected = false;
  io = Object.assign(new MockEmitter(), { reconnection: jest.fn() });
  emit = jest.fn();
  connect = jest.fn(() => {
    this.active = true;
    return this;
  });
  disconnect = jest.fn(() => {
    const wasConnected = this.connected;
    this.active = false;
    this.connected = false;
    if (wasConnected) this.deliver('disconnect', 'io client disconnect');
    return this;
  });
  succeed() {
    this.connected = true;
    this.deliver('connect');
  }
}

const ioMock = io as jest.MockedFunction<typeof io>;
const internal: WatchRoomConfig = { enabled: true, serverType: 'internal' };

describe('WatchRoom socket lifecycle', () => {
  let socket: MockSocket;
  let failed: jest.Mock;
  let succeeded: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    ioMock.mockReset();
    socket = new MockSocket();
    ioMock.mockReturnValue(socket as unknown as ReturnType<typeof io>);
    failed = jest.fn();
    succeeded = jest.fn();
    watchRoomSocketManager.setReconnectFailedCallback(failed);
    watchRoomSocketManager.setReconnectSuccessCallback(succeeded);
  });
  afterEach(() => {
    watchRoomSocketManager.disconnect();
    jest.useRealTimers();
  });

  it('immediately delivers a pending socket so a first transport error cannot orphan later success', async () => {
    const returned = await watchRoomSocketManager.connect(internal);
    expect(returned).toBe(socket);
    expect(watchRoomSocketManager.isConnected()).toBe(false);
    const hookConnected = jest.fn();
    returned.on('connect', hookConnected);
    socket.deliver('connect_error', new Error('websocket unavailable'));
    jest.advanceTimersByTime(120_000);
    expect(failed).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.succeed();
    expect(hookConnected).toHaveBeenCalledTimes(1);
    expect(succeeded).toHaveBeenCalledTimes(1);
    expect(watchRoomSocketManager.isConnected()).toBe(true);
  });

  it('bounds each network attempt and backoff while retaining unlimited attempts', async () => {
    await watchRoomSocketManager.connect(internal);
    expect(ioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/socket.io',
        autoConnect: false,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 10_000,
      })
    );
  });

  it('reuses the same active socket without spawning duplicate transport attempts', async () => {
    const first = await watchRoomSocketManager.connect(internal);
    const second = await watchRoomSocketManager.connect(internal);
    expect(first).toBe(second);
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('preserves external authentication and application isolation fields', async () => {
    await watchRoomSocketManager.connect({
      enabled: true,
      serverType: 'external',
      externalServerUrl: 'http://127.0.0.1:5000',
      externalServerAuth: 'test-credential',
      externalAppId: 'test-app',
    });
    expect(ioMock).toHaveBeenCalledWith(
      'http://127.0.0.1:5000',
      expect.objectContaining({
        auth: { token: 'test-credential', appId: 'test-app' },
        extraHeaders: { Authorization: 'Bearer test-credential' },
      })
    );
  });

  it('rejects invalid external configuration without starting timers or a socket', async () => {
    await expect(
      watchRoomSocketManager.connect({ enabled: true, serverType: 'external' })
    ).rejects.toThrow('External server URL is required');
    expect(ioMock).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['UNAUTHORIZED', 'FORBIDDEN'])(
    'stops on the actual %s error code and cannot silently retry credentials',
    async (code) => {
      await watchRoomSocketManager.connect(internal);
      socket.deliver(
        'connect_error',
        Object.assign(new Error('server rejection'), { data: { code } })
      );
      expect(socket.io.reconnection).toHaveBeenCalledWith(false);
      expect(socket.disconnect).toHaveBeenCalledTimes(1);
      expect(failed).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
      await expect(watchRoomSocketManager.reconnect()).resolves.toBe(false);
      await expect(watchRoomSocketManager.connect(internal)).rejects.toThrow(
        'server rejection'
      );
      expect(socket.connect).toHaveBeenCalledTimes(1);
    }
  );

  it('does not infer an authentication refusal from transport error text', async () => {
    await watchRoomSocketManager.connect(internal);
    socket.deliver(
      'connect_error',
      new Error('Unauthorized transport endpoint')
    );
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it('reports a nonretryable namespace refusal even without an authentication code', async () => {
    await watchRoomSocketManager.connect(internal);
    socket.active = false;
    socket.deliver('connect_error', new Error('incompatible namespace'));
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('stops an established connection when the server revokes its login', async () => {
    await watchRoomSocketManager.connect(internal);
    socket.succeed();
    const pending = watchRoomSocketManager.reconnect();
    await expect(pending).resolves.toBe(true);
    socket.deliver('room:auth-required', { code: 'UNAUTHORIZED' });
    expect(socket.connected).toBe(false);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    await expect(watchRoomSocketManager.reconnect()).resolves.toBe(false);
  });

  it('does not announce Manager reconnect before namespace authentication succeeds', async () => {
    await watchRoomSocketManager.connect(internal);
    socket.io.deliver('reconnect', 6);
    expect(succeeded).not.toHaveBeenCalled();
    socket.succeed();
    expect(succeeded).toHaveBeenCalledTimes(1);
  });

  it('lets manual reconnect survive transient errors and removes its listeners on success', async () => {
    await watchRoomSocketManager.connect(internal);
    const connectedListeners = socket.count('connect');
    const errorListeners = socket.count('connect_error');
    const pending = watchRoomSocketManager.reconnect();
    await Promise.resolve();
    socket.deliver('connect_error', new Error('temporary failure'));
    jest.advanceTimersByTime(4000);
    socket.succeed();
    await expect(pending).resolves.toBe(true);
    expect(socket.count('connect')).toBe(connectedListeners);
    expect(socket.count('connect_error')).toBe(errorListeners);
  });

  it('bounds manual reconnect to five seconds without cancelling background recovery', async () => {
    await watchRoomSocketManager.connect(internal);
    const listeners = socket.count('connect');
    const pending = watchRoomSocketManager.reconnect();
    await Promise.resolve();
    jest.advanceTimersByTime(5000);
    await expect(pending).resolves.toBe(false);
    expect(socket.count('connect')).toBe(listeners);
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.succeed();
    expect(succeeded).toHaveBeenCalledTimes(1);
  });

  it('cancels pending manual reconnect and prevents a logged-out connection from returning', async () => {
    await watchRoomSocketManager.connect(internal);
    const pending = watchRoomSocketManager.reconnect();
    await Promise.resolve();
    const oldConnect = Array.from(socket.handlers.get('connect') || [])[0];
    watchRoomSocketManager.disconnect();
    await expect(pending).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(watchRoomSocketManager.getSocket()).toBeNull();
    await expect(watchRoomSocketManager.reconnect()).resolves.toBe(false);
    oldConnect?.();
    socket.succeed();
    expect(succeeded).not.toHaveBeenCalled();
    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it('ignores events captured from an old socket after a new login creates another', async () => {
    await watchRoomSocketManager.connect(internal);
    const oldConnect = Array.from(socket.handlers.get('connect') || [])[0];
    const oldError = Array.from(socket.handlers.get('connect_error') || [])[0];
    watchRoomSocketManager.disconnect();
    const fresh = new MockSocket();
    ioMock.mockReturnValue(fresh as unknown as ReturnType<typeof io>);
    await watchRoomSocketManager.connect(internal);
    oldConnect?.();
    oldError?.(
      Object.assign(new Error('old refusal'), {
        data: { code: 'UNAUTHORIZED' },
      })
    );
    expect(succeeded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(fresh.disconnect).not.toHaveBeenCalled();
    fresh.succeed();
    expect(succeeded).toHaveBeenCalledTimes(1);
  });

  it('uses visibility only for an inactive recoverable connection and removes the listener on logout', async () => {
    const visibilityListeners = new Set<() => void>();
    const fakeDocument = {
      visibilityState: 'visible',
      addEventListener: jest.fn((_event: string, listener: () => void) =>
        visibilityListeners.add(listener)
      ),
      removeEventListener: jest.fn((_event: string, listener: () => void) =>
        visibilityListeners.delete(listener)
      ),
    };
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: fakeDocument,
    });
    try {
      await watchRoomSocketManager.connect(internal);
      visibilityListeners.forEach((listener) => listener());
      expect(socket.connect).toHaveBeenCalledTimes(1);
      socket.active = false;
      visibilityListeners.forEach((listener) => listener());
      expect(socket.connect).toHaveBeenCalledTimes(2);
      watchRoomSocketManager.disconnect();
      expect(visibilityListeners.size).toBe(0);
    } finally {
      Reflect.deleteProperty(global, 'document');
    }
  });
});

function waitForConnection(socket: WatchRoomSocket, timeout = 10_000) {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('connect', connected);
      reject(new Error('real Socket.IO connection did not recover'));
    }, timeout);
    const connected = () => {
      clearTimeout(timer);
      socket.off('connect', connected);
      resolve();
    };
    socket.on('connect', connected);
  });
}

async function startRealServer(port = 0, refuse = false) {
  const http = createServer();
  const server = new Server(http);
  if (refuse) {
    server.use((_socket, next) => {
      next(
        Object.assign(new Error('login rejected'), {
          data: { code: 'UNAUTHORIZED' },
        })
      );
    });
  }
  server.on('connection', (socket) => {
    socket.on('heartbeat', () =>
      socket.emit('heartbeat:pong', { timestamp: Date.now() })
    );
  });
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, '127.0.0.1', resolve);
  });
  return { server, port: (http.address() as AddressInfo).port };
}

it('recovers a real Socket after a 25-second service outage and more than five attempts', async () => {
  jest.useRealTimers();
  const actualClient =
    jest.requireActual<typeof import('socket.io-client')>('socket.io-client');
  ioMock.mockReset();
  ioMock.mockImplementation(actualClient.io);
  const first = await startRealServer();
  let replacement: Awaited<ReturnType<typeof startRealServer>> | null = null;
  const failed = jest.fn();
  const succeeded = jest.fn();
  watchRoomSocketManager.setReconnectFailedCallback(failed);
  watchRoomSocketManager.setReconnectSuccessCallback(succeeded);
  try {
    const socket = await watchRoomSocketManager.connect({
      enabled: true,
      serverType: 'external',
      externalServerUrl: `http://127.0.0.1:${first.port}`,
    });
    await waitForConnection(socket);
    const attempts: number[] = [];
    socket.io.on('reconnect_attempt', (attempt) => attempts.push(attempt));
    await new Promise<void>((resolve) => first.server.close(() => resolve()));
    await new Promise<void>((resolve) => setTimeout(resolve, 25_000));
    expect(attempts.length).toBeGreaterThan(5);
    expect(socket.connected).toBe(false);
    expect(failed).not.toHaveBeenCalled();
    replacement = await startRealServer(first.port);
    await waitForConnection(socket);
    expect(watchRoomSocketManager.getSocket()).toBe(socket);
    expect(succeeded).toHaveBeenCalledTimes(2);
    watchRoomSocketManager.disconnect();
    expect(socket.active).toBe(false);
    expect(watchRoomSocketManager.getSocket()).toBeNull();
  } finally {
    watchRoomSocketManager.disconnect();
    if (replacement)
      await new Promise<void>((resolve) =>
        replacement?.server.close(() => resolve())
      );
    else
      await new Promise<void>((resolve) => first.server.close(() => resolve()));
  }
}, 45_000);

it('exposes a real initially unavailable socket before its first failure and receives later success', async () => {
  jest.useRealTimers();
  const actualClient =
    jest.requireActual<typeof import('socket.io-client')>('socket.io-client');
  ioMock.mockReset();
  ioMock.mockImplementation(actualClient.io);
  const unavailable = await startRealServer();
  await new Promise<void>((resolve) =>
    unavailable.server.close(() => resolve())
  );
  let replacement: Awaited<ReturnType<typeof startRealServer>> | null = null;
  const recovered = jest.fn();
  watchRoomSocketManager.setReconnectFailedCallback(jest.fn());
  watchRoomSocketManager.setReconnectSuccessCallback(jest.fn());
  try {
    const socket = await watchRoomSocketManager.connect({
      enabled: true,
      serverType: 'external',
      externalServerUrl: `http://127.0.0.1:${unavailable.port}`,
    });
    socket.on('connect', recovered);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('expected initial transport failure')),
        5000
      );
      socket.once('connect_error', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    expect(socket.connected).toBe(false);
    expect(socket.active).toBe(true);
    replacement = await startRealServer(unavailable.port);
    await waitForConnection(socket);
    expect(recovered).toHaveBeenCalledTimes(1);
    expect(watchRoomSocketManager.getSocket()).toBe(socket);
  } finally {
    watchRoomSocketManager.disconnect();
    if (replacement)
      await new Promise<void>((resolve) =>
        replacement?.server.close(() => resolve())
      );
  }
}, 15_000);

it('stops a real authentication refusal without announcing a false recovery or retrying', async () => {
  jest.useRealTimers();
  const actualClient =
    jest.requireActual<typeof import('socket.io-client')>('socket.io-client');
  ioMock.mockReset();
  ioMock.mockImplementation(actualClient.io);
  const fixture = await startRealServer(0, true);
  const succeeded = jest.fn();
  let signalRejected: () => void = () => undefined;
  const rejected = new Promise<void>((resolve) => {
    signalRejected = resolve;
  });
  watchRoomSocketManager.setReconnectFailedCallback(signalRejected);
  watchRoomSocketManager.setReconnectSuccessCallback(succeeded);
  try {
    const socket = await watchRoomSocketManager.connect({
      enabled: true,
      serverType: 'external',
      externalServerUrl: `http://127.0.0.1:${fixture.port}`,
    });
    const attempts = jest.fn();
    socket.io.on('reconnect_attempt', attempts);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        rejected,
        new Promise<void>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('expected authentication rejection')),
            5000
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    expect(socket.active).toBe(false);
    expect(socket.connected).toBe(false);
    expect(socket.io.reconnection()).toBe(false);
    expect(succeeded).not.toHaveBeenCalled();
    expect(attempts).not.toHaveBeenCalled();
    await expect(watchRoomSocketManager.reconnect()).resolves.toBe(false);
  } finally {
    watchRoomSocketManager.disconnect();
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
  }
}, 10_000);
