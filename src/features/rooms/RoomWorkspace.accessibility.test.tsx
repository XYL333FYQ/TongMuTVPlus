jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({ username: 'audit-owner' }),
}));
jest.mock('@/lib/motion', () => ({ useReducedMotionSetting: () => true }));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/WatchRoomProvider', () => ({
  useWatchRoomContext: () => ({
    currentRoom: mockJoined ? mockActiveRoom : null,
    members: [],
    isConnected: true,
    canControl: false,
    isOwner: true,
    notices: [],
    lastError: '',
  }),
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => ({
    controller: null,
    followingRoom: true,
    presentation: 'docked',
    metadata: {},
  }),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import RoomWorkspace from './RoomWorkspace';

import type { Room } from '@/types/watch-room';

let mockJoined = false;
const mockActiveRoom: Room = {
  id: 'audit-room',
  name: '审查测试',
  description: '',
  isPublic: false,
  roomType: 'sync',
  ownerId: 'owner-session',
  ownerName: 'audit-owner',
  ownerAccountId: 'audit-owner',
  memberCount: 1,
  currentState: null,
  createdAt: 0,
  lastOwnerHeartbeat: 0,
  queue: [],
};

const originalFetch = global.fetch;
beforeEach(() => {
  mockJoined = false;
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined));
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('房间弹窗进入后获得焦点，原生取消事件关闭后回到入口', () => {
  render(<RoomWorkspace />);
  const trigger = screen.getByRole('button', { name: '创建房间' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: '创建房间' });
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('弹窗首尾用 Tab 双向循环，不把焦点交给背景或浏览器工具栏', () => {
  render(<RoomWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
  const first = screen.getByRole('button', { name: '关闭' });
  const last = screen.getByRole('button', { name: '创建并进入' });
  first.focus();
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: 'Tab' });
  expect(first).toHaveFocus();
});

test('房间标签方向键和首尾键同步焦点、选中状态及关联面板', () => {
  mockJoined = true;
  render(<RoomWorkspace />);
  const queue = screen.getByRole('tab', { name: '片单 0' });
  const chat = screen.getByRole('tab', { name: '聊天' });
  const members = screen.getByRole('tab', { name: '成员 1' });
  queue.focus();
  fireEvent.keyDown(queue, { key: 'ArrowRight' });
  expect(chat).toHaveFocus();
  expect(chat).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: '聊天' })).toHaveAttribute(
    'id',
    chat.getAttribute('aria-controls')
  );
  expect(queue).toHaveAttribute('tabindex', '-1');
  fireEvent.keyDown(chat, { key: 'End' });
  expect(members).toHaveFocus();
  expect(members).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(members, { key: 'ArrowRight' });
  expect(queue).toHaveFocus();
  expect(queue).toHaveAttribute('aria-selected', 'true');
  expect(
    screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)
  ).toEqual([queue]);
});
