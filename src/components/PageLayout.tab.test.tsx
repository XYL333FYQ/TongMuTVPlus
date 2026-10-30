import { render } from '@testing-library/react';

import PageLayout from '@/components/PageLayout';
import PersistentHeader from '@/components/shell/PersistentHeader';

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
  // 顶栏常驻在根布局：与页面并排渲染，就像 layout.tsx 里那样
  const view = render(
    <>
      <PersistentHeader />
      <PageLayout {...props}>
        <p>内容</p>
      </PageLayout>
    </>
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
      // 页名仍在文档里，留给读屏软件
      expect(header.querySelector('h1')).not.toBeNull();
    }
  );

  test.each(['/about', '/play', '/music'])(
    '%s 不是一级页：保持原有的带页名顶栏',
    (path) => {
      const { shell, header } = renderAt(path);
      expect(shell.dataset.tab).toBe('false');
      expect(header.querySelector('h1')).not.toBeNull();
    }
  );

  test('进入房间后（页面指定了标题）恢复带页名的顶栏，标题来自页面', () => {
    const { shell, header } = renderAt('/watch-room', {
      mobileTitle: '我的房间',
    });
    expect(shell.dataset.tab).toBe('false');
    expect(header.textContent).toContain('我的房间');
  });

  test('页面自带可见一级标题时，顶栏页名不再算标题', () => {
    const { header } = renderAt('/about', { pageHasHeading: true });
    expect(header.querySelector('h1')).toBeNull();
    expect(header.textContent).toContain('关于');
  });

  test('顶栏不在页面外壳里（常驻在根布局），切页只换内容', () => {
    const { shell, header } = renderAt('/search');
    expect(shell.contains(header)).toBe(false);
  });

  test('带副标题的页面保持原样，不收窄', () => {
    const { shell } = renderAt('/search', { mobileSubtitle: '共 3 条' });
    expect(shell.dataset.tab).toBe('false');
  });

  test('不带导航的页面（登录页等）不算一级页', () => {
    const { shell } = renderAt('/', { hideNavigation: true });
    expect(shell.dataset.tab).toBe('false');
  });

  test('带导航的页面放一个底栏显示标记；底栏本身常驻在根布局，不在页面里', () => {
    const { shell } = renderAt('/search');
    expect(shell.querySelector('[data-tm-nav-page]')).not.toBeNull();
    expect(shell.querySelector('.tm-mobile-nav')).toBeNull();
  });

  test('不带导航的页面（登录页、播放页全屏等）没有标记，底栏随之隐藏', () => {
    const { shell } = renderAt('/', { hideNavigation: true });
    expect(shell.querySelector('[data-tm-nav-page]')).toBeNull();
  });
});

test('切页时顶栏是同一份（不销毁重建），只是内容随新页面更新', () => {
  mockPath = '/about';
  const view = render(
    <>
      <PersistentHeader />
      <PageLayout key='about' pageHasHeading>
        <p>关于</p>
      </PageLayout>
    </>
  );
  const before = view.container.querySelector('.tm-mobile-header-v2');
  const desktopBefore = view.container.querySelector('.tm-top-header');
  mockPath = '/movie-request';
  view.rerender(
    <>
      <PersistentHeader />
      <PageLayout key='movie-request' mobileTitle='求片'>
        <p>求片</p>
      </PageLayout>
    </>
  );
  const after = view.container.querySelector('.tm-mobile-header-v2');
  expect(after).toBe(before);
  expect(view.container.querySelector('.tm-top-header')).toBe(desktopBefore);
  expect(after?.textContent).toContain('求片');
  // 新页面没声明自带标题：页名恢复为一级标题
  expect(after?.querySelector('h1')).not.toBeNull();
});
