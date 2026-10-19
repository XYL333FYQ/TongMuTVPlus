import { act, fireEvent, render, screen } from '@testing-library/react';

import ScrollableRow from './ScrollableRow';
import VirtualScrollableRow from './VirtualScrollableRow';

let mockReduced = true;
jest.mock('@/lib/motion', () => ({
  isReducedMotionSetting: () => mockReduced,
  useReducedMotionSetting: () => mockReduced,
}));

const originalScrollWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollWidth'
);
const originalClientWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth'
);
const originalScrollBy = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollBy'
);
const originalResize = Object.getOwnPropertyDescriptor(
  global,
  'ResizeObserver'
);
const originalIntersection = Object.getOwnPropertyDescriptor(
  global,
  'IntersectionObserver'
);
const scroll = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = true;
  scroll.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => 2000,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 500,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
    configurable: true,
    value: scroll,
  });
  const Observer = class {
    observe() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
  };
  Object.defineProperty(global, 'ResizeObserver', {
    configurable: true,
    value: Observer,
  });
  Object.defineProperty(global, 'IntersectionObserver', {
    configurable: true,
    value: Observer,
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  for (const [key, value] of [
    ['scrollWidth', originalScrollWidth],
    ['clientWidth', originalClientWidth],
    ['scrollBy', originalScrollBy],
  ] as const) {
    if (value) Object.defineProperty(HTMLElement.prototype, key, value);
    else Reflect.deleteProperty(HTMLElement.prototype, key);
  }
  for (const [key, value] of [
    ['ResizeObserver', originalResize],
    ['IntersectionObserver', originalIntersection],
  ] as const) {
    if (value) Object.defineProperty(global, key, value);
    else Reflect.deleteProperty(global, key);
  }
});

test('virtual row keeps its original navigation distance while avoiding smooth motion', () => {
  render(
    <VirtualScrollableRow>
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i}>记录 {i + 1}</div>
      ))}
    </VirtualScrollableRow>
  );
  fireEvent.click(screen.getByRole('button', { name: '向右滚动' }));
  expect(scroll).toHaveBeenLastCalledWith({ left: 400, behavior: 'auto' });
});

test('ordinary row uses the existing distance and a named keyboard control', () => {
  render(
    <ScrollableRow scrollDistance={600}>
      <div>推荐影片</div>
    </ScrollableRow>
  );
  act(() => {
    jest.advanceTimersByTime(500);
  });
  fireEvent.click(screen.getByRole('button', { name: '向右滚动' }));
  expect(scroll).toHaveBeenLastCalledWith({ left: 600, behavior: 'auto' });
});

test('a preference change is read at the time of a row action', () => {
  mockReduced = false;
  render(
    <VirtualScrollableRow>
      {Array.from({ length: 20 }, (_, i) => (
        <div key={i}>记录 {i + 1}</div>
      ))}
    </VirtualScrollableRow>
  );
  const right = screen.getByRole('button', { name: '向右滚动' });
  fireEvent.click(right);
  expect(scroll).toHaveBeenLastCalledWith({ left: 400, behavior: 'smooth' });
  mockReduced = true;
  fireEvent.click(right);
  expect(scroll).toHaveBeenLastCalledWith({ left: 400, behavior: 'auto' });
});
