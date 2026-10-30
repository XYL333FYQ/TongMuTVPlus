import { render } from '@testing-library/react';

import PageLayout from '@/components/PageLayout';

let mockPath = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/components/MobileBottomNav', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
jest.mock('@/components/BackButton', () => ({ BackButton: () => null }));
jest.mock('@/components/DesignGridOverlay', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/VersionCheckProvider', () => ({
  VersionCheckProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('@/components/shell/ViewerAccountButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/shell/TongMuNavigation', () => ({
  ...jest.requireActual('@/components/shell/TongMuNavigation'),
  DesktopNavigation: () => null,
}));

beforeAll(() => {
  // jsdom 没有 matchMedia；动效偏好判断用到它
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
  });
});

function renderAt(path: string, props: Record<string, unknown> = {}) {
  mockPath = path;
  const view = render(
    <PageLayout {...props}>
      <p>内容</p>
    </PageLayout>
  );
  return {
    shell: view.container.querySelector('.tm-shell') as HTMLElement,
    header: view.container.querySelector('.tm-mobile-header-v2') as HTMLElement,
  };
}

describe('手机顶栏：底栏上的一级页不再重复页名', () => {
  test.each(['/', '/douban', '/watch-room', '/search', '/my'])(
    '%s 是一级页：顶栏标记为 tab',
    (path) => {
      const { shell, header } = renderAt(path);
      expect(shell.dataset.tab).toBe('true');
      expect(header.dataset.tab).toBe('true');
      // 页名仍在文档里，留给读屏软件
      expect(header.querySelector('h1')).not.toBeNull();
    }
  );

  test.each(['/about', '/play', '/music'])(
    '%s 不是一级页：保持原有的带页名顶栏',
    (path) => {
      const { shell, header } = renderAt(path);
      expect(shell.dataset.tab).toBe('false');
      expect(header.dataset.tab).toBe('false');
    }
  );

  test('进入房间后（页面指定了标题）恢复带页名的顶栏', () => {
    const { shell } = renderAt('/watch-room', { mobileTitle: '房间' });
    expect(shell.dataset.tab).toBe('false');
  });

  test('带副标题的页面保持原样，不收窄', () => {
    const { shell } = renderAt('/search', { mobileSubtitle: '共 3 条' });
    expect(shell.dataset.tab).toBe('false');
  });

  test('不带导航的页面（登录页等）不算一级页', () => {
    const { shell } = renderAt('/', { hideNavigation: true });
    expect(shell.dataset.tab).toBe('false');
  });
});
