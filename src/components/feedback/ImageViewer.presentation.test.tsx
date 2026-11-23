import { act, fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { useState } from 'react';

import { consumeBackLayer } from '@/lib/back-layers';

import ImageViewer from '@/components/feedback/ImageViewer';

let mockReduced = false;
jest.mock('@/lib/motion', () => ({
  useReducedMotionSetting: () => mockReduced,
}));
jest.mock(
  '@/components/ProxyImage',
  () =>
    function Picture({
      originalSrc,
      alt,
    }: {
      originalSrc: string;
      alt: string;
    }) {
      return <img src={originalSrc} alt={alt} />;
    }
);

const originalScrollTo = window.scrollTo;
beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
  window.scrollTo = jest.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  window.scrollTo = originalScrollTo;
});
const props = { isOpen: true, imageUrl: '/qa-image.svg', alt: '查看海报' };

test('removing the preview restores focus to the invoking control', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  try {
    const { unmount } = render(<ImageViewer {...props} onClose={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(48);
    });
    screen.getByRole('button', { name: '关闭' }).focus();
    unmount();
    expect(document.activeElement).toBe(trigger);
  } finally {
    trigger.remove();
  }
});

test('Tab stays on the sole preview control in either direction', () => {
  render(<ImageViewer {...props} onClose={jest.fn()} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  const close = screen.getByRole('button', { name: '关闭' });
  close.focus();
  expect(fireEvent.keyDown(close, { key: 'Tab' })).toBe(false);
  expect(fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(close);
});

test('a conditional caller retains the same picture until the exit has finished', () => {
  function Caller() {
    const [open, setOpen] = useState(true);
    return open ? (
      <ImageViewer {...props} onClose={() => setOpen(false)} />
    ) : null;
  }
  render(<Caller />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  const picture = screen.getByAltText('查看海报');
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  act(() => {
    jest.advanceTimersByTime(250);
  });
  expect(screen.getByAltText('查看海报')).toBe(picture);
  act(() => {
    jest.advanceTimersByTime(70);
  });
  expect(screen.queryByAltText('查看海报')).not.toBeInTheDocument();
});

test('duplicate close requests notify the latest callback once', () => {
  const first = jest.fn(),
    latest = jest.fn();
  const { rerender } = render(<ImageViewer {...props} onClose={first} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  const close = screen.getByRole('button', { name: '关闭' });
  fireEvent.click(close);
  fireEvent.click(close);
  rerender(<ImageViewer {...props} onClose={latest} />);
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
});

test('unmount cancels a deferred close request', () => {
  const closed = jest.fn();
  const { unmount } = render(<ImageViewer {...props} onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  unmount();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(closed).not.toHaveBeenCalled();
});

test('reduced motion closes within 120ms and stops picture displacement', () => {
  mockReduced = true;
  const closed = jest.fn();
  render(<ImageViewer {...props} onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  const picture = screen.getByAltText('查看海报');
  expect(picture.parentElement?.parentElement).toHaveStyle({
    transform: 'none',
  });
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  act(() => {
    jest.advanceTimersByTime(120);
  });
  expect(closed).toHaveBeenCalledTimes(1);
});

test('Escape belongs to the native preview instead of an underlying document listener', () => {
  const underlying = jest.fn();
  document.addEventListener('keydown', underlying);
  const closed = jest.fn();
  render(<ImageViewer {...props} onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  const dialog = screen.getByRole('dialog', { name: '查看海报' });
  fireEvent.keyDown(screen.getByRole('button', { name: '关闭' }), {
    key: 'Escape',
  });
  expect(underlying).not.toHaveBeenCalled();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(closed).toHaveBeenCalledTimes(1);
  document.removeEventListener('keydown', underlying);
});

let clock = 0;
// jsdom 16 没有 PointerEvent：用 MouseEvent 带上 pointerType，每个事件隔 100ms
function pointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientY: number,
  pointerType: 'touch' | 'mouse'
) {
  clock += 100;
  const event = new MouseEvent(type, { bubbles: true, clientY });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'timeStamp', { value: clock });
  act(() => {
    target.dispatchEvent(event);
  });
}

test('the preview opens in the viewer variant of the shared modal layer', () => {
  render(<ImageViewer {...props} onClose={jest.fn()} />);
  expect(screen.getByRole('dialog', { name: '查看海报' })).toHaveClass(
    'tm-modal-layer',
    'tm-modal-layer--viewer'
  );
});

test('the back key closes the preview', () => {
  const closed = jest.fn();
  render(<ImageViewer {...props} onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  act(() => {
    expect(consumeBackLayer()).toBe('handled');
  });
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(closed).toHaveBeenCalledTimes(1);
});

test('the close button is a 44 by 44 target', () => {
  render(<ImageViewer {...props} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: '关闭' })).toHaveClass(
    'tm-image-viewer-close'
  );
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/styles/panels.css'),
    'utf8'
  );
  const rule = css.match(/\.tm-image-viewer-close \{([^}]*)\}/)?.[1] ?? '';
  expect(rule).toMatch(/width: 44px;/);
  expect(rule).toMatch(/height: 44px;/);
});

test('a touch pull-down closes the preview but a mouse drag does not', () => {
  const closed = jest.fn();
  render(<ImageViewer {...props} onClose={closed} />);
  act(() => {
    jest.advanceTimersByTime(48);
  });
  const picture = document.querySelector('.tm-image-viewer-picture');
  if (!picture) throw new Error('Missing picture');
  pointer(picture, 'pointerdown', 100, 'mouse');
  pointer(picture, 'pointermove', 400, 'mouse');
  pointer(picture, 'pointerup', 400, 'mouse');
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(closed).not.toHaveBeenCalled();
  pointer(picture, 'pointerdown', 100, 'touch');
  pointer(picture, 'pointermove', 200, 'touch');
  pointer(picture, 'pointermove', 300, 'touch');
  pointer(picture, 'pointerup', 300, 'touch');
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(closed).toHaveBeenCalledTimes(1);
});
