jest.mock('@/lib/auth', () => ({
  getAuthInfoFromBrowserCookie: () => ({
    username: 'audit-user',
    role: 'owner',
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
  window.RUNTIME_CONFIG = { STORAGE_TYPE: 'd1' };
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
  delete window.RUNTIME_CONFIG;
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

test('原生子弹窗的 Esc 交给子弹窗，不卸载整个账号菜单', async () => {
  render(<UserMenu />);
  const trigger = screen.getByRole('button', { name: '账号菜单' });
  fireEvent.click(trigger);
  const more = await screen.findByRole('button', { name: '更多功能' });
  const dialog =
    document.querySelector<HTMLDialogElement>('.tm-explore-dialog');
  if (!dialog) throw new Error('缺少更多功能弹窗');
  // JSDOM 没有原生 showModal；只补打开状态，不模拟按键处理。
  dialog.showModal = () => dialog.setAttribute('open', '');
  fireEvent.click(more);
  const close = screen.getByRole('button', { name: '关闭更多' });
  close.focus();
  expect(fireEvent.keyDown(close, { key: 'Escape' })).toBe(true);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '更多功能' })).toBe(more);
});

test('账号菜单提供独立的关于入口，点击后关闭菜单', async () => {
  render(<UserMenu />);
  const trigger = screen.getByRole('button', { name: '账号菜单' });
  fireEvent.click(trigger);
  const about = await screen.findByRole('link', {
    name: '关于 TongMuTV Plus',
  });
  expect(about).toHaveAttribute('href', '/about');
  const settings = screen.getByRole('button', { name: '设置' });
  const admin = screen.getByRole('button', { name: '管理面板' });
  expect(settings.closest('.tm-menu-group')).toBe(
    admin.closest('.tm-menu-group')
  );
  expect(about.closest('.tm-menu-group')).not.toBe(
    admin.closest('.tm-menu-group')
  );
  expect(
    admin.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(about.closest('.tm-menu-group')?.textContent).toBe(
    '关于 TongMuTV Plus'
  );
  fireEvent.click(about);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('link', { name: '关于 TongMuTV Plus' })).toBeNull();
});
