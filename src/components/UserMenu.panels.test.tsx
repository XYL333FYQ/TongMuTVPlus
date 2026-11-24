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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { UserMenu } from './UserMenu';

const originalFetch = global.fetch;
const originalMatchMedia = window.matchMedia;
const originalScrollTo = window.scrollTo;

beforeEach(() => {
  window.RUNTIME_CONFIG = { STORAGE_TYPE: 'd1', ENABLE_TVBOX_SUBSCRIBE: true };
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ unreadCount: 0, token: 'tvbox-token' }),
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
  window.scrollTo = originalScrollTo;
  Reflect.deleteProperty(window, '__unreadNotificationCount');
  Reflect.deleteProperty(window, '__loadingNotifications');
});

async function openFromMenu(entry: string, heading: string) {
  fireEvent.click(screen.getByRole('button', { name: '账号菜单' }));
  fireEvent.click(await screen.findByText(entry, { selector: 'span' }));
  return screen.findByRole('heading', { name: heading });
}

test('the settings panel opens as a drawer in the shared modal layer and locks the page', async () => {
  render(<UserMenu />);
  const heading = await openFromMenu('设置', '本地设置');
  const layer = heading.closest('dialog');
  expect(layer).toHaveClass('tm-modal-layer', 'tm-modal-layer--drawer');
  expect(document.body.style.position).toBe('fixed');
  const close = layer?.querySelector<HTMLButtonElement>(
    'button[aria-label="Close"]'
  );
  if (!close) throw new Error('Missing close button');
  fireEvent.click(close);
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: '本地设置' })).toBeNull()
  );
  expect(document.body.style.position).toBe('');
});

test.each([
  ['电视访问', '电视访问'],
  ['客户端安装', '客户端安装指南'],
])(
  'the “%s” panel opens in the panel variant (bottom on phones, right on tablets, centred on desktop)',
  async (entry, heading) => {
    render(<UserMenu />);
    const layer = (await openFromMenu(entry, heading)).closest('dialog');
    expect(layer).toHaveClass('tm-modal-layer');
    expect(layer).toHaveClass('tm-modal-layer', 'tm-modal-layer--panel');
  }
);

test('resetting the subscribe token asks with the shared confirm and cancelling keeps the panel', async () => {
  render(<UserMenu />);
  await openFromMenu('电视访问', '电视访问');
  fireEvent.click(await screen.findByRole('button', { name: '重置订阅Token' }));
  const confirm = await screen.findByRole('alertdialog', {
    name: '重置订阅Token',
  });
  expect(confirm).toHaveClass('tm-modal-layer', 'tm-modal-layer--confirm');
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.getByRole('heading', { name: '电视访问' })).toBeInTheDocument();
  expect(document.body.style.position).toBe('fixed');
});
