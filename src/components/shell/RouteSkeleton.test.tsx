import { cleanup, render } from '@testing-library/react';

import RouteSkeleton from './RouteSkeleton';

let mockPath = '/douban';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({
    activePath,
    instant,
    children,
  }: {
    activePath: string;
    instant?: boolean;
    children: React.ReactNode;
  }) => (
    <div data-layout={activePath} data-instant={String(Boolean(instant))}>
      {children}
    </div>
  ),
}));

afterEach(cleanup);

describe('RouteSkeleton', () => {
  it('目标就是这个一级页：用同样的外壳画出骨架，且不播进场动画', () => {
    mockPath = '/douban';
    const { container } = render(<RouteSkeleton path='/douban' />);
    const layout = container.querySelector('[data-layout]') as HTMLElement;
    expect(layout.dataset.layout).toBe('/douban');
    expect(layout.dataset.instant).toBe('true');
    expect(container.querySelectorAll('.tm-skeleton').length).toBeGreaterThan(
      3
    );
    expect(
      container.querySelector('[role="status"][aria-busy="true"]')
    ).not.toBeNull();
  });
  it('目标是子页面：什么都不画，交给子页面自己的外壳', () => {
    mockPath = '/watch-room/screen';
    const { container } = render(<RouteSkeleton path='/watch-room' />);
    expect(container).toBeEmptyDOMElement();
  });
  it('列表变体画卡片骨架', () => {
    mockPath = '/search';
    const { container } = render(
      <RouteSkeleton path='/search' variant='list' />
    );
    expect(container.querySelector('.tm-route-skeleton-list')).not.toBeNull();
    expect(container.querySelector('.tm-route-skeleton-grid')).toBeNull();
  });
});
