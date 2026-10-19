import { act, fireEvent, render, screen } from '@testing-library/react';

import CapsuleSwitch from './CapsuleSwitch';

const options = [
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'series' },
  { label: '动漫', value: 'anime' },
];
let systemReduced = false;
const scrollTo = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  scrollTo.mockClear();
  systemReduced = false;
  delete document.documentElement.dataset.tmReducedMotion;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches: systemReduced,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  });
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const left = this.tagName === 'BUTTON' ? 240 : 0;
      return {
        x: left,
        y: 0,
        left,
        right: left + 160,
        top: 0,
        bottom: 44,
        width: 160,
        height: 44,
        toJSON: () => ({}),
      };
    });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete document.documentElement.dataset.tmReducedMotion;
});

test('preserves option order, selected state and the existing change callback', () => {
  const onChange = jest.fn();
  render(
    <CapsuleSwitch options={options} active='series' onChange={onChange} />
  );
  expect(
    screen.getAllByRole('button').map((button) => button.textContent)
  ).toEqual(['电影', '剧集', '动漫']);
  expect(screen.getByRole('button', { name: '剧集' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: '动漫' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('anime');
});

test.each(['system', 'site'])(
  'overflow scroll is immediate with the %s reduced-motion preference',
  (mode) => {
    systemReduced = mode === 'system';
    if (mode === 'site')
      document.documentElement.dataset.tmReducedMotion = 'true';
    render(
      <CapsuleSwitch options={options} active='anime' onChange={jest.fn()} />
    );
    act(() => jest.runOnlyPendingTimers());
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' })
    );
  }
);

test('keeps smooth scrolling in normal mode', () => {
  render(
    <CapsuleSwitch options={options} active='anime' onChange={jest.fn()} />
  );
  act(() => jest.runOnlyPendingTimers());
  expect(scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: 'smooth' })
  );
});

test('a drag does not activate an option, and a later click still works', () => {
  const onChange = jest.fn();
  const { container } = render(
    <CapsuleSwitch options={options} active='movie' onChange={onChange} />
  );
  const scroller = container.querySelector('.scrollbar-hide');
  if (!scroller) throw new Error('Missing horizontal option scroller');
  const start = new MouseEvent('mousedown', { bubbles: true, clientX: 10 });
  const move = new MouseEvent('mousemove', { bubbles: true, clientX: 50 });
  Object.defineProperty(start, 'pageX', { value: 10 });
  Object.defineProperty(move, 'pageX', { value: 50 });
  fireEvent(scroller, start);
  fireEvent(scroller, move);
  fireEvent.mouseUp(scroller);
  fireEvent.click(screen.getByRole('button', { name: '剧集' }));
  expect(onChange).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(60));
  fireEvent.click(screen.getByRole('button', { name: '剧集' }));
  expect(onChange).toHaveBeenCalledWith('series');
});
