import { act, fireEvent, render, screen } from '@testing-library/react';

import LoadingStylePreview from './LoadingStylePreview';

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
});

afterEach(() => {
  jest.useRealTimers();
  delete document.documentElement.dataset.tmReducedMotion;
});

test('preview completes once, replays and resets when the selected style changes', () => {
  const { container, rerender, unmount } = render(
    <LoadingStylePreview style='grid' />
  );
  const phrase = () => container.querySelector('.mtv-tal-phrase');
  expect(phrase()).toHaveTextContent('正在获取影片详情');
  act(() => jest.advanceTimersByTime(1400));
  expect(phrase()).toHaveTextContent('正在选择播放线路');
  act(() => jest.advanceTimersByTime(2800));
  expect(phrase()).toHaveTextContent('已准备好播放');
  expect(container.querySelector('[data-preview-still]')).toHaveAttribute(
    'data-preview-still',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: '重新播放' }));
  expect(phrase()).toHaveTextContent('正在获取影片详情');
  act(() => jest.advanceTimersByTime(1400));
  rerender(<LoadingStylePreview style='classic' />);
  expect(phrase()).toHaveTextContent('正在获取影片详情');
  expect(
    container.querySelector('[data-preview-loading-style]')
  ).toHaveAttribute('data-preview-loading-style', 'classic');
  expect(document.documentElement).not.toHaveAttribute('data-loading-style');
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('site reduced motion shows a still preview without scheduled stage changes', () => {
  document.documentElement.dataset.tmReducedMotion = 'true';
  const { container } = render(<LoadingStylePreview style='talisman' />);
  expect(container.querySelector('[data-preview-still]')).toHaveAttribute(
    'data-preview-still',
    'true'
  );
  act(() => jest.advanceTimersByTime(10000));
  expect(container.querySelector('.mtv-tal-phrase')).toHaveTextContent(
    '正在获取影片详情'
  );
  expect(jest.getTimerCount()).toBe(0);
});
