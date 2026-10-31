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
import { resetThumbMotion } from './mobileNavThumb';

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

// jsdom 没有版面：第 i 项占 [i*60, i*60+60)
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

// 点链接时 jsdom 会尝试真的跳转并报"未实现"，在最外层拦掉
const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  push.mockClear();
  mockPath = '/';
  resetThumbMotion();
  document.addEventListener('click', stopNavigation);
});
afterEach(() => {
  document.removeEventListener('click', stopNavigation);
  jest.useRealTimers();
  cleanup();
});

function setup() {
  // 记下底栏尺寸观察器的回调：布局量得到之后由它触发滑块重新定位
  let resized: () => void = jest.fn();
  const Original = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback: () => void) {
      resized = callback;
    }
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
  const view = render(<MobileBottomNav />);
  window.ResizeObserver = Original;
  const nav = screen.getByRole('navigation', { name: '主导航' });
  const links = screen.getAllByRole('link');
  layoutItems(links);
  nav.getBoundingClientRect = () => ({ left: 0 } as DOMRect);
  act(() => resized());
  const thumb = () =>
    nav.querySelector<HTMLElement>('.tm-mobile-nav-thumb')?.style.transform;
  return { nav, links, thumb, view };
}

describe('手机底栏：点下去立刻响应，不等新页面渲染完', () => {
  it('点未选中的一项：高亮与滑块马上过去，读屏认的当前页仍是真实路由', () => {
    const { links, thumb } = setup();
    expect(thumb()).toBe('translateX(0px)');
    fireEvent.click(links[2]);
    // 路由还没换（pathname 没变），滑块已经往房间去了
    expect(links[2]).toHaveAttribute('data-active', 'true');
    expect(links[0]).toHaveAttribute('data-active', 'false');
    expect(thumb()).toBe('translateX(120px)');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[2]).not.toHaveAttribute('aria-current');
  });

  it('路由到了之后：当前页跟上，滑块停在原处不再动', () => {
    const { links, thumb, view } = setup();
    fireEvent.click(links[2]);
    mockPath = '/watch-room';
    view.rerender(<MobileBottomNav />);
    expect(links[2]).toHaveAttribute('aria-current', 'page');
    expect(links[2]).toHaveAttribute('data-active', 'true');
    expect(links[0]).not.toHaveAttribute('aria-current');
    expect(thumb()).toBe('translateX(120px)');
  });

  it('点已经选中的那一项：什么都不变', () => {
    const { links, thumb } = setup();
    fireEvent.click(links[0]);
    expect(links[0]).toHaveAttribute('data-active', 'true');
    expect(thumb()).toBe('translateX(0px)');
  });

  it('页面迟迟没到：等到超时，滑块退回真实所在的页', () => {
    jest.useFakeTimers();
    const { links, thumb } = setup();
    fireEvent.click(links[3]);
    expect(thumb()).toBe('translateX(180px)');
    act(() => {
      jest.advanceTimersByTime(5900);
    });
    expect(thumb()).toBe('translateX(180px)');
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(thumb()).toBe('translateX(0px)');
    expect(links[0]).toHaveAttribute('data-active', 'true');
  });

  it('按着修饰键点（新标签页打开）：滑块不动', () => {
    const { links, thumb } = setup();
    fireEvent.click(links[2], { ctrlKey: true });
    expect(links[0]).toHaveAttribute('data-active', 'true');
    expect(thumb()).toBe('translateX(0px)');
  });

  it('按住拖动后松手：高亮停在目标上，同时发起跳转', () => {
    const { nav, links, thumb } = setup();
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
    fireEvent.pointerUp(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 150,
    });
    expect(push).toHaveBeenCalledWith('/watch-room');
    // 路由还没换，滑块与高亮已经定在房间上，不会弹回发现
    expect(links[2]).toHaveAttribute('data-active', 'true');
    expect(links[0]).toHaveAttribute('data-active', 'false');
    expect(thumb()).toBe('translateX(120px)');
  });

  it('拖回原来的那一页松手：不跳转，也不留着"将要去"的状态', () => {
    const { nav, links, thumb } = setup();
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
    expect(links[0]).toHaveAttribute('data-active', 'true');
    expect(thumb()).toBe('translateX(0px)');
  });
});

it.each(['mouse', 'touch', 'keyboard'])(
  'a later %s activation is not swallowed when a drag produced no compatibility click',
  (kind) => {
    const { nav, links } = setup();
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
    fireEvent.pointerUp(nav, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 150,
    });
    if (kind !== 'keyboard') {
      fireEvent.pointerDown(links[4], {
        pointerId: 2,
        pointerType: kind,
        clientX: 270,
      });
      fireEvent.pointerUp(links[4], {
        pointerId: 2,
        pointerType: kind,
        clientX: 270,
      });
    }
    fireEvent.click(links[4], { detail: kind === 'keyboard' ? 0 : 1 });
    expect(links[4]).toHaveAttribute('data-active', 'true');
  }
);

it('the immediate compatibility click after drag still cannot navigate back to the pressed link', () => {
  const { nav, links } = setup();
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
  fireEvent.pointerUp(nav, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 150,
  });
  fireEvent.click(links[0], { detail: 1 });
  expect(links[2]).toHaveAttribute('data-active', 'true');
});
