jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContextSafe: () => mockRoom,
}));
jest.mock('./context', () => ({ usePlaybackSessionSafe: () => mockSession }));

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { RoomRealtimeMessage } from '@/hooks/useWatchRoom';

import PlaybackRoomMessages from './RoomLiveMessages';

import type { ChatMessage } from '@/types/watch-room';

const listeners = new Set<(event: RoomRealtimeMessage) => void>();
let root: HTMLDivElement;
let mockSession: {
  href: string;
  followingRoom: boolean;
  controller: { video: HTMLVideoElement; template?: { $player: HTMLElement } };
};
let mockRoom: ReturnType<typeof makeRoom>;
function makeRoom() {
  return {
    currentRoom: {
      id: 'alpha',
      currentState: {
        type: 'play',
        source: 'fixture',
        videoId: 'film-a',
        episode: 1,
      },
    },
    isConnected: true,
    chatMessages: [{ content: '历史消息不能飘屏' }],
    markChatRead: jest.fn(),
    roomCommand: jest.fn<
      Promise<{ success: boolean }>,
      [string, Record<string, unknown>]
    >(async () => ({ success: true })),
    subscribeToRoomMessages: jest.fn(
      (listener: (event: RoomRealtimeMessage) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    ),
  };
}
function message(id: string, content = '你好'): ChatMessage {
  return {
    id,
    content,
    userId: 'friend-device',
    userName: '朋友',
    accountId: 'friend',
    type: 'text',
    timestamp: Date.now(),
    seq: Number(id) || 1,
  };
}
function deliver(value: ChatMessage, roomId = mockRoom.currentRoom.id) {
  act(() => {
    listeners.forEach((listener) => listener({ roomId, message: value }));
  });
}
function composer(value: string) {
  fireEvent.click(screen.getByRole('button', { name: '发送房间消息' }));
  const input = screen.getByRole('textbox', { name: '房间消息内容' });
  fireEvent.change(input, { target: { value } });
  return input;
}
beforeEach(() => {
  jest.useFakeTimers();
  listeners.clear();
  let command = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => `message-command-${++command}` },
  });
  root = document.createElement('div');
  root.className = 'art-video-player';
  const video = document.createElement('video');
  root.append(video);
  document.body.append(root);
  mockSession = {
    href: '/play?source=fixture&id=film-a&episode=1',
    followingRoom: true,
    controller: { video },
  };
  mockRoom = makeRoom();
});
afterEach(() => {
  cleanup();
  root.remove();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('survives an activity player destroying its own HTML before React removes the overlay', () => {
  const view = render(<PlaybackRoomMessages />);
  deliver(message('destroyed'));
  // Artplayer.template.destroy() detaches its root by clearing the outer container.
  const container = document.createElement('div');
  document.body.append(container);
  container.append(root);
  container.innerHTML = '';
  mockSession.followingRoom = false;
  expect(() => view.rerender(<PlaybackRoomMessages />)).not.toThrow();
  expect(listeners.size).toBe(0);
  container.remove();
});

test('a paused movie receives realtime messages inside its fullscreen container, without replaying chat history or marking it read', () => {
  render(<PlaybackRoomMessages />);
  expect(screen.queryByText('历史消息不能飘屏')).not.toBeInTheDocument();
  expect(root).toContainElement(
    screen.getByRole('button', { name: '发送房间消息' })
  );
  expect(mockSession.controller.video.paused).toBe(true);
  deliver(message('1'));
  expect(root).toContainElement(screen.getByText('朋友：你好'));
  expect(mockRoom.markChatRead).not.toHaveBeenCalled();
});

test('the actual Artplayer fullscreen root is supported, preferring its public template over a guessed CSS wrapper', () => {
  root.className = 'art-video-player';
  const view = render(<PlaybackRoomMessages />);
  expect(root).toContainElement(
    screen.getByRole('button', { name: '发送房间消息' })
  );
  root.className = 'custom-player';
  mockSession.controller.template = { $player: root };
  view.rerender(<PlaybackRoomMessages />);
  expect(root).toContainElement(
    screen.getByRole('button', { name: '发送房间消息' })
  );
});

test('a normal message burst waits for free lanes rather than silently replacing unseen messages', () => {
  render(<PlaybackRoomMessages />);
  for (let index = 1; index <= 12; index++)
    deliver(message(String(index), `排队${index}`));
  expect(screen.getByText('朋友：排队1')).toBeInTheDocument();
  expect(screen.queryByText('朋友：排队12')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(7000));
  expect(screen.getByText('朋友：排队5')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(7000));
  expect(screen.getByText('朋友：排队12')).toBeInTheDocument();
});

test('a repeated message never displays twice, including after its first presentation expires', () => {
  render(<PlaybackRoomMessages />);
  const value = message('1');
  deliver(value);
  deliver(value);
  expect(screen.getAllByText('朋友：你好')).toHaveLength(1);
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.queryByText('朋友：你好')).not.toBeInTheDocument();
  deliver(value);
  expect(screen.queryByText('朋友：你好')).not.toBeInTheDocument();
});

test('personal or different-film viewing does not subscribe or display the old room messages', () => {
  mockSession.followingRoom = false;
  const view = render(<PlaybackRoomMessages />);
  expect(listeners.size).toBe(0);
  mockSession.followingRoom = true;
  mockSession.href = '/play?source=fixture&id=film-b';
  view.rerender(<PlaybackRoomMessages />);
  expect(listeners.size).toBe(0);
  mockSession.href = '/play?source=fixture&id=film-a';
  view.rerender(<PlaybackRoomMessages />);
  expect(listeners.size).toBe(1);
  const old = Array.from(listeners)[0];
  mockSession.followingRoom = false;
  view.rerender(<PlaybackRoomMessages />);
  act(() => old({ roomId: 'alpha', message: message('1') }));
  expect(screen.queryByText('朋友：你好')).not.toBeInTheDocument();
});

test('player input sends through the canonical room command and waits for its confirmed stream to show the message', async () => {
  render(<PlaybackRoomMessages />);
  const input = composer('  一起看真好  ');
  expect(root).toContainElement(input);
  expect(input).toHaveFocus();
  const hotkey = jest.fn();
  document.addEventListener('keydown', hotkey);
  fireEvent.keyDown(input, { key: 'k' });
  expect(hotkey).not.toHaveBeenCalled();
  document.removeEventListener('keydown', hotkey);
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(input).toHaveValue(''));
  expect(mockRoom.roomCommand).toHaveBeenCalledWith(
    'chat:message',
    expect.objectContaining({
      roomId: 'alpha',
      content: '一起看真好',
      type: 'text',
      commandId: expect.any(String),
    })
  );
  expect(screen.queryByText('朋友：一起看真好')).not.toBeInTheDocument();
  deliver(message('1', '一起看真好'));
  expect(screen.getByText('朋友：一起看真好')).toBeInTheDocument();
});

test('failed sending keeps the draft and reuses the same command when retrying the same message', async () => {
  mockRoom.roomCommand.mockRejectedValueOnce(new Error('确认超时'));
  render(<PlaybackRoomMessages />);
  const input = composer('不要丢草稿');
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await screen.findByText('确认超时');
  expect(input).toHaveValue('不要丢草稿');
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(input).toHaveValue(''));
  expect(mockRoom.roomCommand.mock.calls[1][1].commandId).toBe(
    mockRoom.roomCommand.mock.calls[0][1].commandId
  );
});

test('two submissions in the same event turn send only one command', async () => {
  let confirm!: () => void;
  mockRoom.roomCommand.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        confirm = () => resolve({ success: true });
      })
  );
  render(<PlaybackRoomMessages />);
  composer('只发一次');
  const form = screen.getByRole('form', { name: '发送房间消息' });
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(mockRoom.roomCommand).toHaveBeenCalledTimes(1);
  await act(async () => confirm());
});

test('a confirmed old draft does not clear text typed while its acknowledgement was pending', async () => {
  let confirm!: () => void;
  mockRoom.roomCommand.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        confirm = () => resolve({ success: true });
      })
  );
  render(<PlaybackRoomMessages />);
  const input = composer('第一条');
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  fireEvent.change(input, { target: { value: '第二条草稿' } });
  await act(async () => confirm());
  expect(input).toHaveValue('第二条草稿');
});

test('a former room failure cannot overwrite the new room draft or sending state', async () => {
  let fail!: (error: Error) => void;
  mockRoom.roomCommand.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      })
  );
  const view = render(<PlaybackRoomMessages />);
  composer('旧房消息');
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  mockRoom.currentRoom.id = 'beta';
  view.rerender(<PlaybackRoomMessages />);
  const next = composer('新房草稿');
  await act(async () => fail(new Error('旧房已取消')));
  expect(next).toHaveValue('新房草稿');
  expect(screen.queryByText('旧房已取消')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '发送' })).not.toBeDisabled();
});

test('hiding live display preserves sending and never replays messages received while hidden', () => {
  render(<PlaybackRoomMessages />);
  deliver(message('1'));
  fireEvent.click(screen.getByRole('button', { name: '隐藏房间消息' }));
  expect(screen.queryByText('朋友：你好')).not.toBeInTheDocument();
  deliver(message('2', '隐藏期间'));
  fireEvent.click(screen.getByRole('button', { name: '显示房间消息' }));
  expect(screen.queryByText('朋友：隐藏期间')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '发送房间消息' })
  ).toBeInTheDocument();
  expect(mockRoom.roomCommand).not.toHaveBeenCalled();
});

test('bursts stay bounded and unmount removes display timers and subscription', () => {
  const view = render(<PlaybackRoomMessages />);
  for (let index = 1; index <= 12; index++)
    deliver(message(String(index), `新消息${index}`));
  expect(
    root.querySelectorAll('[data-tm-room-message]').length
  ).toBeGreaterThan(0);
  expect(
    root.querySelectorAll('[data-tm-room-message]').length
  ).toBeLessThanOrEqual(4);
  view.unmount();
  expect(listeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});
