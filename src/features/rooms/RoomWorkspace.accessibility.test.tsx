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
    currentRoom: null,
    isConnected: true,
    notices: [],
    lastError: '',
  }),
}));
jest.mock('@/features/playback/context', () => ({
  usePlaybackSession: () => ({ controller: null }),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import RoomWorkspace from './RoomWorkspace';

const originalFetch = global.fetch;
beforeEach(() => {
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
