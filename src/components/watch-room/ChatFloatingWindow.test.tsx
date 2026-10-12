jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSessionSafe: () => null,
}));
jest.mock('@/hooks/useVoiceChat', () => ({
  useVoiceChat: () => ({ isConnecting: false, error: null }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react';

import ChatFloatingWindow from './ChatFloatingWindow';

function makeRoom() {
  return {
    currentRoom: {
      id: 'room-a',
      name: '阅读验收',
      memberCount: 2,
      unreadCount: 2,
    },
    members: [],
    socket: null as { id: string; on: jest.Mock; off: jest.Mock } | null,
    isConnected: true,
    canControl: false,
    notices: [] as { id: string; message: string; timestamp: number }[],
    chatMessages: [1, 2].map((seq) => ({
      id: `message-${seq}`,
      seq,
      userName: 'friend',
      content: `消息 ${seq}`,
      type: 'text',
      timestamp: 1700000000000,
    })),
    markChatRead: jest.fn<Promise<void>, [number]>(() => Promise.resolve()),
    roomCommand: jest.fn(() => Promise.resolve()),
    loadChatHistory: jest.fn(() => Promise.resolve([])),
  };
}
let mockRoom = makeRoom();
let visibility: DocumentVisibilityState = 'visible';
let focused = true;
let observers: TestIntersectionObserver[] = [];
const originalVisibility = Object.getOwnPropertyDescriptor(
  document,
  'visibilityState'
);
const originalIntersectionObserver = window.IntersectionObserver;
const originalMatchMedia = window.matchMedia;
let desktop = false;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0, 0.5, 1];
  readonly targets = new Set<Element>();
  constructor(private callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  show(seq: number, ratio = 1) {
    const target = Array.from(this.targets).find(
      (element) => element.getAttribute('data-seq') === String(seq)
    );
    if (!target) throw new Error(`消息 ${seq} 没有被观察`);
    const bounds = target.getBoundingClientRect();
    this.callback(
      [
        {
          target,
          time: 0,
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
          boundingClientRect: bounds,
          intersectionRect: bounds,
          rootBounds: bounds,
        },
      ],
      this
    );
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  mockRoom = makeRoom();
  visibility = 'visible';
  focused = true;
  observers = [];
  desktop = false;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  jest.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  window.IntersectionObserver = TestIntersectionObserver;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  window.IntersectionObserver = originalIntersectionObserver;
  window.matchMedia = originalMatchMedia;
  if (originalVisibility)
    Object.defineProperty(document, 'visibilityState', originalVisibility);
  else Reflect.deleteProperty(document, 'visibilityState');
});

test('desktop embeds one chat panel and only visible messages are read', async () => {
  desktop = true;
  const slot = document.createElement('div');
  slot.dataset.tmRoomChatSlot = '';
  slot.dataset.active = 'false';
  document.body.appendChild(slot);
  const view = render(<ChatFloatingWindow />);
  expect(slot.querySelectorAll('.tm-chat-panel')).toHaveLength(1);
  expect(
    screen.queryByRole('button', { name: '房间聊天，2条未读' })
  ).not.toBeInTheDocument();
  observers[observers.length - 1].show(1);
  await advance(350);
  expect(mockRoom.markChatRead).toHaveBeenCalledWith(1);
  fireEvent.change(screen.getByRole('textbox', { name: '消息内容' }), {
    target: { value: '保留草稿' },
  });
  await act(async () => slot.remove());
  fireEvent.click(screen.getByRole('button', { name: '房间聊天，2条未读' }));
  expect(screen.getByRole('textbox', { name: '消息内容' })).toHaveValue(
    '保留草稿'
  );
  view.unmount();
});

test('hidden tablet chat does not read messages until chat tab is selected', async () => {
  const slot = document.createElement('div');
  slot.dataset.tmRoomChatSlot = '';
  slot.dataset.active = 'false';
  document.body.appendChild(slot);
  const view = render(<ChatFloatingWindow />);
  expect(observers).toHaveLength(0);
  await advance(1000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  await act(async () => {
    slot.dataset.active = 'true';
  });
  observers[observers.length - 1].show(2);
  await advance(350);
  expect(mockRoom.markChatRead).toHaveBeenCalledWith(2);
  mockRoom.markChatRead.mockClear();
  await act(async () => {
    slot.dataset.active = 'false';
  });
  await advance(1000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  view.unmount();
  slot.remove();
});

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
function openChat() {
  fireEvent.click(screen.getByRole('button', { name: '房间聊天，2条未读' }));
  const observer = observers[observers.length - 1];
  if (!observer) throw new Error('打开聊天后未建立可见性观察');
  return observer;
}

test('room notice expires after four seconds and a later notice gets its own timer', async () => {
  mockRoom.notices = [
    { id: 'one', message: '另一位成员正在主持', timestamp: Date.now() },
  ];
  const view = render(<ChatFloatingWindow />);
  expect(screen.getByRole('status')).toHaveTextContent('另一位成员正在主持');
  await advance(3000);
  mockRoom.notices = [
    { id: 'two', message: '主持交接完成', timestamp: Date.now() },
  ];
  view.rerender(<ChatFloatingWindow />);
  await advance(1000);
  expect(screen.getByRole('status')).toHaveTextContent('主持交接完成');
  await advance(2999);
  expect(screen.getByRole('status')).toBeInTheDocument();
  await advance(1);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
test('handover to another session stays visible before the old controller snapshot changes', async () => {
  mockRoom.canControl = true;
  const on = jest.fn();
  mockRoom.socket = { id: 'self-session', on, off: jest.fn() };
  const view = render(<ChatFloatingWindow />);
  const changed = on.mock.calls.find(
    (call) => call[0] === 'room:controller-changed'
  )?.[1];
  act(() => changed({ controllerSessionId: 'another-session' }));
  mockRoom.notices = [
    {
      id: 'handover',
      message: '房间主持已更新，影片继续播放',
      timestamp: Date.now(),
    },
  ];
  view.rerender(<ChatFloatingWindow />);
  expect(screen.getByRole('status')).toHaveTextContent('房间主持已更新');
  await advance(4000);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('self hosting suppresses only the hosting notice, not other notices', () => {
  mockRoom.canControl = true;
  mockRoom.notices = [
    {
      id: 'self',
      message: '房间主持已更新，影片继续播放',
      timestamp: Date.now(),
    },
  ];
  const view = render(<ChatFloatingWindow />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  mockRoom.notices = [
    { id: 'other', message: '房间成员已更新', timestamp: Date.now() },
  ];
  view.rerender(<ChatFloatingWindow />);
  expect(screen.getByRole('status')).toHaveTextContent('房间成员已更新');
});
test('self controller event is suppressed before the full room snapshot arrives', () => {
  const on = jest.fn();
  mockRoom.socket = { id: 'self-session', on, off: jest.fn() };
  const view = render(<ChatFloatingWindow />);
  const callback = on.mock.calls.find(
    (call) => call[0] === 'room:controller-changed'
  )?.[1];
  expect(callback).toBeDefined();
  act(() => callback({ controllerSessionId: 'self-session' }));
  mockRoom.notices = [
    {
      id: 'new-host',
      message: '房间主持已更新，影片继续播放',
      timestamp: Date.now(),
    },
  ];
  view.rerender(<ChatFloatingWindow />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});

test('collapsed chat and opening alone do not read; only sufficiently visible messages advance the cursor', async () => {
  render(<ChatFloatingWindow />);
  await advance(2000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  const observer = openChat();
  await advance(2000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  act(() => {
    observer.show(1, 0.49);
    observer.show(2, 0);
  });
  await advance(350);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  act(() => observer.show(1, 0.5));
  await advance(349);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  await advance(1);
  expect(mockRoom.markChatRead).toHaveBeenCalledTimes(1);
  expect(mockRoom.markChatRead).toHaveBeenLastCalledWith(1);
  await advance(2000);
  expect(mockRoom.markChatRead).toHaveBeenCalledTimes(1);
});

test('visible messages remain unread while hidden or unfocused, then read when foreground focus returns', async () => {
  render(<ChatFloatingWindow />);
  const observer = openChat();
  visibility = 'hidden';
  act(() => observer.show(2));
  await advance(2000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  visibility = 'visible';
  focused = false;
  fireEvent(document, new Event('visibilitychange'));
  await advance(2000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  focused = true;
  fireEvent(window, new Event('focus'));
  await advance(350);
  expect(mockRoom.markChatRead).toHaveBeenCalledTimes(1);
  expect(mockRoom.markChatRead).toHaveBeenLastCalledWith(2);
});

test('closing chat cancels a pending read, and failed acknowledgement is retried instead of losing unread state', async () => {
  render(<ChatFloatingWindow />);
  const observer = openChat();
  act(() => observer.show(2));
  fireEvent.click(
    screen.getByRole('button', { name: '收起聊天，继续接收消息' })
  );
  await advance(2000);
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
  mockRoom.markChatRead.mockRejectedValueOnce(
    new Error('temporary disconnect')
  );
  const reopened = openChat();
  act(() => reopened.show(2));
  await advance(350);
  expect(mockRoom.markChatRead).toHaveBeenCalledTimes(1);
  await advance(650);
  expect(mockRoom.markChatRead).toHaveBeenCalledTimes(2);
  expect(mockRoom.markChatRead).toHaveBeenLastCalledWith(2);
  await advance(2000);
  expect(mockRoom.markChatRead).toHaveBeenCalledTimes(2);
});
