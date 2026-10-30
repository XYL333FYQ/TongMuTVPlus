const push = jest.fn();
let mockPath = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push }),
}));

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import MobileBottomNav from './MobileBottomNav';

// 部分 jsdom 版本没有 PointerEvent，补一个带 pointerId / pointerType 的最小实现
if (typeof window.PointerEvent === 'undefined') {
  class FakePointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent =
    FakePointerEvent;
}

// jsdom 没有版面：给每个底栏项一个固定宽度的矩形，第 i 项占 [i*60, i*60+60)
function layoutItems(items: HTMLElement[]) {
  items.forEach((el, index) => {
    Object.defineProperty(el, 'offsetLeft', { value: index * 60 });
    Object.defineProperty(el, 'offsetWidth', { value: 60 });
    el.getBoundingClientRect = () =>
      ({
        left: index * 60,
        width: 60,
        right: index * 60 + 60,
      } as DOMRect);
  });
}

beforeEach(() => {
  push.mockClear();
  mockPath = '/';
});
afterEach(cleanup);

function setup() {
  render(<MobileBottomNav />);
  const nav = screen.getByRole('navigation', { name: '主导航' });
  const links = screen.getAllByRole('link');
  layoutItems(links);
  nav.getBoundingClientRect = () => ({ left: 0 } as DOMRect);
  return { nav, links };
}

describe('手机底栏按住拖动', () => {
  it('横向拖过阈值后，松手跳转到手指所在的那一项', () => {
    const { nav } = setup();
    fireEvent.pointerDown(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 30,
    });
    fireEvent.pointerMove(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 150,
    });
    expect(nav).toHaveAttribute('data-scrubbing', 'true');
    fireEvent.pointerUp(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 150,
    });
    expect(push).toHaveBeenCalledWith('/watch-room');
  });

  it('页面卡顿：最后一次移动后 React 还没渲染手指就抬起，仍然跳转', () => {
    const { nav } = setup();
    // 同一个 act 里连续派发，等价于主线程忙时 move 和 up 挤在同一次渲染之前
    act(() => {
      nav.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          pointerType: 'touch',
          clientX: 30,
          bubbles: true,
        })
      );
      nav.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          pointerType: 'touch',
          clientX: 150,
          bubbles: true,
        })
      );
      nav.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 1,
          pointerType: 'touch',
          clientX: 150,
          bubbles: true,
        })
      );
    });
    expect(push).toHaveBeenCalledWith('/watch-room');
  });

  it('移动很小仍是普通点按，不触发拖动跳转', () => {
    const { nav } = setup();
    fireEvent.pointerDown(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 30,
    });
    fireEvent.pointerMove(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 34,
    });
    fireEvent.pointerUp(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 34,
    });
    expect(push).not.toHaveBeenCalled();
    expect(nav).not.toHaveAttribute('data-scrubbing');
  });

  it('拖回原来选中的项，松手不重复跳转', () => {
    const { nav } = setup();
    fireEvent.pointerDown(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 150,
    });
    fireEvent.pointerMove(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 140,
    });
    fireEvent.pointerMove(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 20,
    });
    fireEvent.pointerUp(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 20,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('拖动取消时不跳转', () => {
    const { nav } = setup();
    fireEvent.pointerDown(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 30,
    });
    fireEvent.pointerMove(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 200,
    });
    fireEvent.pointerCancel(nav, { pointerId: 1, pointerType: 'touch' });
    expect(push).not.toHaveBeenCalled();
    expect(nav).not.toHaveAttribute('data-scrubbing');
  });

  it('滑块出现在当前选中项上，当前项标记 aria-current', () => {
    mockPath = '/search';
    const { nav, links } = setup();
    expect(links[3]).toHaveAttribute('aria-current', 'page');
    expect(nav.querySelector('.tm-mobile-nav-thumb')).toBeTruthy();
  });
});
