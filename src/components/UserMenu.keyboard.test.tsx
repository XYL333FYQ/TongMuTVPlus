jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({
    username: 'audit-user',
    role: 'user',
  }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/watch-room',
}));
// 账号菜单不会渲染 AI 正文；隔离旧 Jest 无法直接加载的外部 ESM 渲染器。
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { UserMenu } from './UserMenu';

const originalFetch = global.fetch;
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ unreadCount: 0 }),
    text: async () => '',
  });
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
});
afterEach(() => {
  global.fetch = originalFetch;
  window.matchMedia = originalMatchMedia;
  Reflect.deleteProperty(window, '__unreadNotificationCount');
  Reflect.deleteProperty(window, '__loadingNotifications');
});

test('账号菜单通过 Esc 关闭、移除遮罩并回焦头像', async () => {
  render(<UserMenu />);
  const trigger = screen.getByRole('button', { name: '账号菜单' });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByRole('radiogroup', { name: '外观' });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('radiogroup', { name: '外观' })).toBeNull();
  expect(document.querySelector('.fixed.inset-0.bg-transparent')).toBeNull();
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
