import { act, cleanup, renderHook } from '@testing-library/react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { watchRoomSocketManager } from '@/lib/watch-room-socket';
import type { ChatMessage, Room } from '@/types/watch-room';

import { useWatchRoom } from './useWatchRoom';

jest.mock('@/lib/auth', () => ({ getAuthInfoFromBrowserCookie: jest.fn() }));
jest.mock('@/lib/watch-room-socket', () => ({
  watchRoomSocketManager: {
    connect: jest.fn(),
    getSocket: jest.fn(),
    disconnect: jest.fn(),
  },
}));

type Ack = (timeout: Error | null, reply: Record<string, unknown>) => void;
class MockSocket {
  connected = true;
  id = 'alice-connection';
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  calls: Array<{ event: string; payload: Record<string, any> }> = [];
  replies = new Map<string, (payload: Record<string, any>, ack: Ack) => void>();
  on(event: string, handler: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) || new Set();
    listeners.add(handler);
    this.listeners.set(event, listeners);
    return this;
  }
  off(event: string, handler: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(handler);
    return this;
  }
  timeout() {
    return this;
  }
  emit(event: string, payload: Record<string, any> = {}, ack?: Ack) {
    this.calls.push({ event, payload });
    if (ack) {
      const handler = this.replies.get(event);
      if (handler) handler(payload, ack);
      else ack(null, { success: true });
    }
    return this;
  }
  deliver(event: string, data?: unknown) {
    if (event === 'connect') this.connected = true;
    if (event === 'disconnect') this.connected = false;
    this.listeners.get(event)?.forEach((handler) => handler(data));
  }
}

function room(id: string, overrides: Partial<Room> = {}): Room {
  return {
    id,
    name: id,
    description: '',
    isPublic: true,
    roomType: 'sync',
    ownerId: 'alice',
    ownerName: 'alice',
    ownerAccountId: 'alice',
    controllerSessionId: 'alice-connection',
    controllerAccountId: 'alice',
    revision: 1,
    controllerEpoch: 3,
    memberCount: 1,
    currentState: null,
    createdAt: Date.now(),
    lastOwnerHeartbeat: Date.now(),
    lastMessageSeq: 0,
    unreadCount: 0,
    ...overrides,
  };
}
function messages(id: string, first: number, last: number): ChatMessage[] {
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const seq = first + index;
    return {
      id: `${id}-message-${seq}`,
      userId: 'bob-connection',
      userName: 'bob',
      accountId: 'bob',
      content: `message ${seq}`,
      seq,
      timestamp: 1800000000000 + seq,
      type: 'text',
    };
  });
}
function snapshot(value: Room, history: ChatMessage[] = []) {
  return { success: true, room: value, members: [], messages: history };
}
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
async function setup() {
  const socket = new MockSocket();
  (watchRoomSocketManager.connect as jest.Mock).mockResolvedValue(socket);
  (watchRoomSocketManager.getSocket as jest.Mock).mockImplementation(
    () => socket
  );
  (watchRoomSocketManager.disconnect as jest.Mock).mockImplementation(() => {
    socket.connected = false;
  });
  const view = renderHook(() => useWatchRoom());
  await act(async () => {
    await view.result.current.connect({
      enabled: true,
      serverType: 'internal',
    });
  });
  return { ...view, socket };
}
async function join(
  view: Awaited<ReturnType<typeof setup>>,
  value: Room,
  history: ChatMessage[] = []
) {
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(null, snapshot(value, history))
  );
  await act(async () => {
    await view.result.current.joinRoom({ roomId: value.id, userName: 'alice' });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue({
    username: 'alice',
    role: 'user',
  });
  let id = 0;
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID: () => `command-${++id}` },
  });
});
afterEach(cleanup);

test('reconnect fills an offline gap longer than the 100-message join window without duplicates', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10 }), messages('A', 1, 10));
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 260, unreadCount: 250 }),
        messages('A', 161, 260)
      )
    )
  );
  view.socket.replies.set('chat:history', (payload, ack) =>
    ack(null, {
      success: true,
      messages: messages(
        'A',
        payload.afterSeq + 1,
        Math.min(payload.afterSeq + payload.limit, 260)
      ),
    })
  );
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  expect(view.result.current.isConnected).toBe(true);
  expect(
    view.result.current.chatMessages.map((message) => message.seq)
  ).toEqual(Array.from({ length: 260 }, (_, index) => index + 1));
  expect(
    view.socket.calls
      .filter((call) => call.event === 'chat:history')
      .map((call) => call.payload.afterSeq)
  ).toEqual([10, 110, 210]);
  expect(view.result.current.currentRoom?.unreadCount).toBe(250);
});

test('duplicate realtime deliveries add one message and increment unread only once', async () => {
  const view = await setup();
  await join(view, room('A'));
  const message = messages('A', 1, 1)[0];
  act(() => {
    view.socket.deliver('chat:message', message);
    view.socket.deliver('chat:message', { ...message });
  });
  expect(view.result.current.chatMessages).toEqual([message]);
  expect(view.result.current.currentRoom?.unreadCount).toBe(1);
  expect(view.result.current.currentRoom?.lastMessageSeq).toBe(1);
});

test('realtime replay of a snapshot message is not counted again and own messages do not add unread', async () => {
  const view = await setup();
  const initial = messages('A', 1, 1)[0];
  await join(view, room('A', { lastMessageSeq: 1, unreadCount: 1 }), [initial]);
  const own = {
    ...messages('A', 2, 2)[0],
    accountId: 'alice',
    userName: 'alice',
  };
  act(() => {
    view.socket.deliver('chat:message', initial);
    view.socket.deliver('chat:message', own);
  });
  expect(view.result.current.chatMessages).toEqual([initial, own]);
  expect(view.result.current.currentRoom?.unreadCount).toBe(1);
});

test('markChatRead sends the sequence with command metadata and applies the server unread count', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 200, unreadCount: 8 }));
  view.socket.replies.set('chat:read', (_payload, ack) =>
    ack(null, {
      success: true,
      revision: 1,
      controllerEpoch: 3,
      unreadCount: 0,
      lastReadSeq: 200,
    })
  );
  await act(async () => {
    await view.result.current.markChatRead(200);
  });
  expect(
    view.socket.calls.find((call) => call.event === 'chat:read')?.payload
  ).toEqual(
    expect.objectContaining({
      seq: 200,
      commandId: expect.any(String),
      controllerEpoch: 3,
      baseRevision: 1,
    })
  );
  expect(view.result.current.currentRoom?.unreadCount).toBe(0);
});

test('older beforeSeq history is merged in ascending order while retaining the latest window', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 139 }), messages('A', 90, 139));
  view.socket.replies.set('chat:history', (_payload, ack) =>
    ack(null, { success: true, messages: messages('A', 40, 89) })
  );
  await act(async () => {
    await view.result.current.loadChatHistory(undefined, 90);
  });
  expect(
    view.socket.calls.find((call) => call.event === 'chat:history')?.payload
  ).toEqual(expect.objectContaining({ beforeSeq: 90, limit: 50 }));
  expect(
    view.result.current.chatMessages.map((message) => message.seq)
  ).toEqual(Array.from({ length: 100 }, (_, index) => index + 40));
});

test('an old room manual-history reply cannot enter the newly joined room', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 100 }), messages('A', 100, 100));
  let reply: Ack | undefined;
  let pending!: Promise<ChatMessage[]>;
  view.socket.replies.set('chat:history', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.loadChatHistory(undefined, 100);
  });
  await join(view, room('B', { lastMessageSeq: 10 }), messages('B', 1, 10));
  expect(reply).toBeDefined();
  await act(async () => {
    reply!(null, { success: true, messages: messages('A', 50, 99) });
    await pending.catch(() => []);
  });
  expect(view.result.current.currentRoom?.id).toBe('B');
  expect(
    view.result.current.chatMessages.filter(
      (message) => !message.id.startsWith('B-')
    ).length
  ).toBe(0);
  expect(view.result.current.chatMessages).toHaveLength(10);
});

test('an old room reconnect-history reply cannot enter a room joined while the reply was pending', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10 }), messages('A', 1, 10));
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 160 }),
        messages('A', 61, 160)
      )
    )
  );
  let reply: Ack | undefined;
  view.socket.replies.set('chat:history', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  expect(reply).toBeDefined();
  await join(view, room('B', { lastMessageSeq: 10 }), messages('B', 1, 10));
  await act(async () => {
    reply!(null, { success: true, messages: messages('A', 11, 110) });
  });
  expect(view.result.current.currentRoom?.id).toBe('B');
  expect(
    view.result.current.chatMessages.filter(
      (message) => !message.id.startsWith('B-')
    ).length
  ).toBe(0);
  expect(view.result.current.chatMessages).toHaveLength(10);
});

test('disconnect tears down the manager and late history cannot repopulate logged-out room state', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 100 }), messages('A', 100, 100));
  let reply: Ack | undefined;
  let pending!: Promise<ChatMessage[]>;
  view.socket.replies.set('chat:history', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.loadChatHistory(undefined, 100);
  });
  act(() => {
    view.result.current.disconnect();
  });
  expect(watchRoomSocketManager.disconnect).toHaveBeenCalledTimes(1);
  expect(view.result.current.isConnected).toBe(false);
  expect(view.result.current.currentRoom).toBeNull();
  await act(async () => {
    reply!(null, { success: true, messages: messages('A', 50, 99) });
    await pending.catch(() => []);
  });
  expect(view.result.current.chatMessages.length).toBe(0);
  expect(view.result.current.currentRoom).toBeNull();
});

test('a failed reconnect-history page is retried on the next reconnect instead of permanently skipping the hole', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10 }), messages('A', 1, 10));
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 260 }),
        messages('A', 161, 260)
      )
    )
  );
  view.socket.replies.set('chat:history', (payload, ack) => {
    if (payload.afterSeq === 10)
      ack(null, { success: true, messages: messages('A', 11, 110) });
    else ack(new Error('simulated missing page'), {});
  });
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  expect(view.result.current.lastError).toBeTruthy();
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 3, lastMessageSeq: 270 }),
        messages('A', 171, 270)
      )
    )
  );
  view.socket.replies.set('chat:history', (payload, ack) =>
    ack(null, {
      success: true,
      messages: messages(
        'A',
        payload.afterSeq + 1,
        Math.min(payload.afterSeq + payload.limit, 270)
      ),
    })
  );
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  const received = new Set(
    view.result.current.chatMessages.map((message) => message.seq)
  );
  expect(
    Array.from({ length: 270 }, (_, index) => index + 1).filter(
      (seq) => !received.has(seq)
    )
  ).toEqual([]);
});

test('a former room read acknowledgement cannot clear unread in the newly joined room', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10, unreadCount: 10 }));
  let reply: Ack | undefined;
  let pending!: Promise<void>;
  view.socket.replies.set('chat:read', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.markChatRead(10);
  });
  await join(view, room('B', { lastMessageSeq: 7, unreadCount: 7 }));
  await act(async () => {
    reply!(null, {
      success: true,
      revision: 1,
      controllerEpoch: 3,
      unreadCount: 0,
      lastReadSeq: 10,
    });
    await pending.catch(() => undefined);
  });
  expect(view.result.current.currentRoom?.id).toBe('B');
  expect(view.result.current.currentRoom?.unreadCount).toBe(7);
});

test('a join acknowledgement arriving after disconnect cannot restore logged-out room state', async () => {
  const view = await setup();
  let reply: Ack | undefined;
  let pending!: Promise<unknown>;
  view.socket.replies.set('room:join', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.joinRoom({ roomId: 'A', userName: 'alice' });
  });
  act(() => {
    view.result.current.disconnect();
  });
  await act(async () => {
    reply!(null, snapshot(room('A'), messages('A', 1, 10)));
    await pending.catch(() => undefined);
  });
  expect(view.result.current.currentRoom).toBeNull();
  expect(view.result.current.chatMessages).toHaveLength(0);
  expect(localStorage.getItem('watch_room_info')).toBeNull();
});

test('A to B to A invalidates history from the previous visit even when the room id matches again', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 100 }), messages('A', 100, 100));
  let reply: Ack | undefined;
  let pending!: Promise<ChatMessage[]>;
  view.socket.replies.set('chat:history', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.loadChatHistory(undefined, 100);
  });
  await join(view, room('B'), messages('B', 1, 1));
  await join(
    view,
    room('A', { revision: 2, lastMessageSeq: 210 }),
    messages('A', 201, 210)
  );
  await act(async () => {
    reply!(null, { success: true, messages: messages('A', 50, 99) });
    await pending.catch(() => []);
  });
  expect(view.result.current.currentRoom?.id).toBe('A');
  expect(
    view.result.current.chatMessages.map((message) => message.seq)
  ).toEqual([201, 202, 203, 204, 205, 206, 207, 208, 209, 210]);
});

test('A to B to A invalidates a read acknowledgement from the previous visit', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10, unreadCount: 10 }));
  let reply: Ack | undefined;
  let pending!: Promise<void>;
  view.socket.replies.set('chat:read', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.markChatRead(10);
  });
  await join(view, room('B'));
  await join(
    view,
    room('A', { revision: 2, lastMessageSeq: 19, unreadCount: 9 })
  );
  await act(async () => {
    reply!(null, {
      success: true,
      revision: 1,
      controllerEpoch: 3,
      unreadCount: 0,
      lastReadSeq: 10,
    });
    await pending.catch(() => undefined);
  });
  expect(view.result.current.currentRoom?.id).toBe('A');
  expect(view.result.current.currentRoom?.revision).toBe(2);
  expect(view.result.current.currentRoom?.unreadCount).toBe(9);
});

test('a newer join supersedes an older pending join and keeps the newer room remembered', async () => {
  const view = await setup();
  let olderReply: Ack | undefined;
  let pending!: Promise<unknown>;
  view.socket.replies.set('room:join', (payload, ack) => {
    if (payload.roomId === 'older') olderReply = ack;
    else ack(null, snapshot(room('newer'), messages('newer', 1, 1)));
  });
  act(() => {
    pending = view.result.current.joinRoom({
      roomId: 'older',
      userName: 'alice',
    });
  });
  await act(async () => {
    await view.result.current.joinRoom({ roomId: 'newer', userName: 'alice' });
  });
  await act(async () => {
    olderReply!(null, snapshot(room('older'), messages('older', 1, 1)));
    await pending.catch(() => undefined);
  });
  expect(view.result.current.currentRoom?.id).toBe('newer');
  expect(view.result.current.chatMessages[0]?.id).toBe('newer-message-1');
  expect(
    JSON.parse(localStorage.getItem('watch_room_info') || '{}').roomId
  ).toBe('newer');
});

test('a connect promise resolving after logout cannot restore the socket or connected state', async () => {
  const socket = new MockSocket();
  let connected!: (value: MockSocket) => void;
  (watchRoomSocketManager.connect as jest.Mock).mockImplementation(
    () =>
      new Promise((resolve) => {
        connected = resolve;
      })
  );
  (watchRoomSocketManager.getSocket as jest.Mock).mockImplementation(
    () => socket
  );
  (watchRoomSocketManager.disconnect as jest.Mock).mockImplementation(() => {
    socket.connected = false;
  });
  const view = renderHook(() => useWatchRoom());
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.connect({
      enabled: true,
      serverType: 'internal',
    });
  });
  (getAuthInfoFromBrowserCookie as jest.Mock).mockReturnValue(null);
  act(() => {
    view.result.current.disconnect();
  });
  await act(async () => {
    connected(socket);
    await pending;
  });
  expect(view.result.current.socket).toBeNull();
  expect(view.result.current.isConnected).toBe(false);
  expect(view.result.current.currentRoom).toBeNull();
});

test('logging in again can rejoin while the previous connection still has an unfinished rejoin request', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10 }), messages('A', 1, 10));
  let oldReply: Ack | undefined;
  view.socket.replies.set('room:join', (_payload, ack) => {
    oldReply = ack;
  });
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  expect(oldReply).toBeDefined();
  act(() => {
    view.result.current.disconnect();
  });
  const nextSocket = new MockSocket();
  nextSocket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 11 }),
        messages('A', 1, 11)
      )
    )
  );
  (watchRoomSocketManager.connect as jest.Mock).mockResolvedValue(nextSocket);
  (watchRoomSocketManager.getSocket as jest.Mock).mockImplementation(
    () => nextSocket
  );
  await act(async () => {
    await view.result.current.connect({
      enabled: true,
      serverType: 'internal',
    });
  });
  await act(async () => {
    oldReply!(null, snapshot(room('A'), messages('A', 1, 10)));
  });
  await settle();
  expect(
    nextSocket.calls.filter((call) => call.event === 'room:join').length
  ).toBe(1);
  expect(view.result.current.currentRoom?.id).toBe('A');
  expect(view.result.current.currentRoom?.lastMessageSeq).toBe(11);
});

test('a manual-history acknowledgement from before a transport reconnect is ignored on the same socket object', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 100 }), messages('A', 100, 100));
  let oldReply: Ack | undefined;
  let pending!: Promise<ChatMessage[]>;
  view.socket.replies.set('chat:history', (payload, ack) => {
    if (payload.beforeSeq === 100) oldReply = ack;
    else
      ack(null, {
        success: true,
        messages: messages(
          'A',
          payload.afterSeq + 1,
          Math.min(payload.afterSeq + payload.limit, 300)
        ),
      });
  });
  act(() => {
    pending = view.result.current.loadChatHistory(undefined, 100);
  });
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 300 }),
        messages('A', 201, 300)
      )
    )
  );
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  await act(async () => {
    oldReply!(null, { success: true, messages: messages('A', 50, 99) });
    await pending.catch(() => []);
  });
  expect(view.result.current.chatMessages[0]?.seq).toBe(100);
  expect(view.result.current.chatMessages).toHaveLength(201);
  expect(view.result.current.currentRoom?.revision).toBe(2);
});

test('a read acknowledgement from before a transport reconnect cannot overwrite newer unread state', async () => {
  const view = await setup();
  await join(
    view,
    room('A', { lastMessageSeq: 10, unreadCount: 10 }),
    messages('A', 1, 10)
  );
  let oldReply: Ack | undefined;
  let pending!: Promise<void>;
  view.socket.replies.set('chat:read', (_payload, ack) => {
    oldReply = ack;
  });
  act(() => {
    pending = view.result.current.markChatRead(10);
  });
  view.socket.replies.set('room:join', (_payload, ack) =>
    ack(
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 21, unreadCount: 11 }),
        messages('A', 11, 21)
      )
    )
  );
  view.socket.replies.set('chat:history', (_payload, ack) =>
    ack(null, { success: true, messages: messages('A', 11, 21) })
  );
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  await act(async () => {
    oldReply!(null, {
      success: true,
      revision: 1,
      unreadCount: 0,
      lastReadSeq: 10,
    });
    await pending.catch(() => undefined);
  });
  expect(view.result.current.currentRoom?.revision).toBe(2);
  expect(view.result.current.currentRoom?.unreadCount).toBe(11);
  expect(view.result.current.lastError).toBe('');
});

test('a stale rejoin finally cannot release the lock owned by a newer transport connection', async () => {
  const view = await setup();
  await join(view, room('A', { lastMessageSeq: 10 }), messages('A', 1, 10));
  const replies: Ack[] = [];
  view.socket.replies.set('room:join', (_payload, ack) => {
    replies.push(ack);
  });
  view.socket.replies.set('chat:history', (_payload, ack) =>
    ack(null, { success: true, messages: messages('A', 11, 21) })
  );
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  act(() => {
    view.socket.deliver('disconnect');
    view.socket.deliver('connect');
  });
  await settle();
  expect(replies.length).toBe(2);
  await act(async () => {
    replies[0](null, snapshot(room('A'), messages('A', 1, 10)));
  });
  act(() => {
    view.socket.deliver('connect');
  });
  await settle();
  expect(replies.length).toBe(2);
  await act(async () => {
    replies[1](
      null,
      snapshot(
        room('A', { revision: 2, lastMessageSeq: 21 }),
        messages('A', 11, 21)
      )
    );
  });
  await settle();
  expect(view.result.current.currentRoom?.lastMessageSeq).toBe(21);
  expect(view.result.current.isConnected).toBe(true);
});

test('a late read acknowledgement cannot roll back a newer snapshot revision on the same connection', async () => {
  const view = await setup();
  await join(
    view,
    room('A', { revision: 1, lastMessageSeq: 1, unreadCount: 1 })
  );
  let reply: Ack | undefined;
  let pending!: Promise<void>;
  view.socket.replies.set('chat:read', (_payload, ack) => {
    reply = ack;
  });
  act(() => {
    pending = view.result.current.markChatRead(1);
  });
  act(() => {
    view.socket.deliver(
      'room:snapshot',
      snapshot(room('A', { revision: 5, lastMessageSeq: 1, unreadCount: 0 }))
    );
  });
  expect(view.result.current.currentRoom?.revision).toBe(5);
  await act(async () => {
    if (!reply) throw new Error('Expected pending chat:read acknowledgement');
    reply(null, {
      success: true,
      revision: 1,
      controllerEpoch: 3,
      unreadCount: 0,
      lastReadSeq: 1,
    });
    await pending.catch(() => undefined);
  });
  expect(view.result.current.currentRoom?.revision).toBe(5);
});

test.each(['room:sync-applied', 'room:ready', 'chat:read'])(
  'a superseded %s rejects without replacing a newer real room error',
  async (event) => {
    const view = await setup();
    await join(view, room('A'));
    let oldReply: Ack | undefined;
    view.socket.replies.set(event, (_payload, ack) => {
      oldReply = ack;
    });
    let pending!: Promise<unknown>;
    act(() => {
      pending = view.result.current.roomCommand(event);
    });
    // Attach the rejection assertion before completing the delayed acknowledgement.
    const rejected = expect(pending).rejects.toThrow('本次操作已取消');
    await join(view, room('B'));
    act(() => {
      view.socket.deliver('error', '当前房间的真实错误');
    });
    await act(async () => {
      oldReply!(null, { success: true, revision: 99, unreadCount: 0 });
      await rejected;
    });
    expect(view.result.current.currentRoom?.id).toBe('B');
    expect(view.result.current.currentRoom?.revision).toBe(1);
    expect(view.result.current.lastError).toBe('当前房间的真实错误');
  }
);

test.each([
  [
    'server rejection',
    null,
    { success: false, error: '没有主持权限' },
    '没有主持权限',
  ],
  ['timeout', new Error('timeout'), {}, '房间操作超时，请检查状态后重试'],
] as const)(
  'a current command still reports %s',
  async (_name, timeout, reply, message) => {
    const view = await setup();
    await join(view, room('A'));
    view.socket.replies.set('room:ready', (_payload, ack) =>
      ack(timeout, reply)
    );
    await act(async () => {
      await expect(
        view.result.current.roomCommand('room:ready')
      ).rejects.toThrow(message);
    });
    expect(view.result.current.lastError).toBe(message);
  }
);

test('deleting the room succeeds even though room:deleted arrives before the acknowledgement', async () => {
  const view = await setup();
  await join(view, room('A'));
  // 服务端真实顺序：先广播 room:deleted，再回确认
  view.socket.replies.set('room:delete', (_payload, ack) => {
    view.socket.deliver('room:deleted', { reason: 'owner_deleted' });
    ack(null, { success: true, deleted: true });
  });
  const deletedEvents = jest.fn();
  window.addEventListener('tongmu:room-deleted', deletedEvents);

  let outcome: unknown;
  await act(async () => {
    outcome = await view.result.current.roomCommand('room:delete', {});
  });

  expect(outcome).toEqual({ success: true });
  expect(view.result.current.currentRoom).toBeNull();
  expect(view.result.current.lastError).toBe('');
  expect(deletedEvents).toHaveBeenCalledTimes(1);
  window.removeEventListener('tongmu:room-deleted', deletedEvents);
});

test('other commands cancelled by a room deletion still report as superseded', async () => {
  const view = await setup();
  await join(view, room('A'));
  view.socket.replies.set('queue:add', (_payload, ack) => {
    view.socket.deliver('room:deleted', { reason: 'owner_deleted' });
    ack(null, { success: true });
  });

  await act(async () => {
    await expect(
      view.result.current.roomCommand('queue:add', {})
    ).rejects.toThrow('房间已切换');
  });
});
