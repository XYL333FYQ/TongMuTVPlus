import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { closeTopLayer } from '@/lib/shell-bridge';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import MobileActionSheet from '@/components/feedback/MobileActionSheet';

let mockReduced = false;
jest.mock('@/lib/motion', () => ({
  useReducedMotionSetting: () => mockReduced,
}));
jest.mock(
  'next/image',
  () =>
    function Picture({ src, alt }: { src: string; alt: string }) {
      return <img src={src} alt={alt} />;
    }
);
const scrollTo = window.scrollTo;
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
  window.scrollTo = scrollTo;
});
const props = {
  isOpen: true,
  title: '影片操作',
  poster: '/poster.svg',
  actions: [],
};
const settle = () =>
  act(() => {
    jest.advanceTimersByTime(48);
  });

test('Tab wraps between the sheet controls without leaving the page', () => {
  render(
    <MobileActionSheet
      {...props}
      onClose={jest.fn()}
      actions={[{ id: 'play', label: '播放', icon: null, onClick: jest.fn() }]}
    />
  );
  settle();
  const buttons = screen.getAllByRole('button');
  const first = buttons[0],
    last = buttons[buttons.length - 1];
  last.focus();
  expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
  expect(document.activeElement).toBe(first);
  expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
  expect(document.activeElement).toBe(last);
});

test('removing the sheet restores focus to its connected invoker', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  try {
    const { unmount } = render(
      <MobileActionSheet {...props} onClose={jest.fn()} />
    );
    settle();
    screen.getByRole('button', { name: '关闭操作菜单' }).focus();
    unmount();
    expect(document.activeElement).toBe(trigger);
  } finally {
    trigger.remove();
  }
});

test('the action sheet is a named native dialog with a keyboard poster trigger', () => {
  const poster = jest.fn(),
    closed = jest.fn();
  render(
    <MobileActionSheet {...props} onClose={closed} onPosterClick={poster} />
  );
  settle();
  expect(screen.getByRole('dialog', { name: '影片操作' })).toHaveAttribute(
    'open'
  );
  fireEvent.click(screen.getByRole('button', { name: '查看海报' }));
  expect(poster).toHaveBeenCalledTimes(1);
  expect(closed).not.toHaveBeenCalled();
});
test('Escape is owned by the sheet instead of underlying document listeners', () => {
  const underlying = jest.fn(),
    closed = jest.fn();
  document.addEventListener('keydown', underlying);
  try {
    render(<MobileActionSheet {...props} onClose={closed} />);
    settle();
    fireEvent.keyDown(screen.getByRole('button', { name: '关闭操作菜单' }), {
      key: 'Escape',
    });
    expect(underlying).not.toHaveBeenCalled();
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true })
    );
    expect(closed).toHaveBeenCalledTimes(1);
  } finally {
    document.removeEventListener('keydown', underlying);
  }
});
test('normal exit retains the panel for 320ms after the caller closes it', () => {
  function Caller() {
    const [open, setOpen] = useState(true);
    return (
      <MobileActionSheet
        {...props}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    );
  }
  render(<Caller />);
  settle();
  const dialog = screen.getByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: '关闭操作菜单' }));
  act(() => {
    jest.advanceTimersByTime(250);
  });
  expect(dialog.isConnected).toBe(true);
  act(() => {
    jest.advanceTimersByTime(70);
  });
  expect(dialog.isConnected).toBe(false);
});
test('reduced motion has no displacement and releases the panel within 120ms', () => {
  mockReduced = true;
  const { rerender } = render(
    <MobileActionSheet {...props} onClose={jest.fn()} />
  );
  settle();
  const dialog = screen.getByRole('dialog');
  expect(dialog.querySelector('.tm-action-sheet-panel')).toHaveStyle({
    transform: 'none',
  });
  rerender(<MobileActionSheet {...props} isOpen={false} onClose={jest.fn()} />);
  act(() => {
    jest.advanceTimersByTime(120);
  });
  expect(dialog.isConnected).toBe(false);
});
test('repeated activation runs an existing action and close callback once', () => {
  const action = jest.fn(),
    closed = jest.fn();
  render(
    <MobileActionSheet
      {...props}
      onClose={closed}
      actions={[{ id: 'play', label: '播放', icon: null, onClick: action }]}
    />
  );
  settle();
  fireEvent.click(screen.getByRole('button', { name: '播放' }));
  fireEvent.click(screen.getByRole('button', { name: '播放' }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledTimes(1);
});
test('a zero episode does not leak a bare zero into the action row', () => {
  render(
    <MobileActionSheet
      {...props}
      onClose={jest.fn()}
      currentEpisode={0}
      totalEpisodes={12}
      actions={[{ id: 'play', label: '播放', icon: null, onClick: jest.fn() }]}
    />
  );
  settle();
  expect(screen.getByRole('button', { name: '播放' })).toHaveTextContent(
    /^播放$/
  );
});
test('the long-press release cannot close the sheet unless the press began on its backdrop', () => {
  const closed = jest.fn();
  render(<MobileActionSheet {...props} onClose={closed} />);
  settle();
  const backdrop = document.querySelector('.tm-action-sheet-backdrop');
  expect(backdrop).not.toBeNull();
  if (!backdrop) throw new Error('Missing backdrop');
  fireEvent.click(backdrop);
  expect(closed).not.toHaveBeenCalled();
  fireEvent.pointerDown(backdrop);
  fireEvent.click(backdrop);
  expect(closed).toHaveBeenCalledTimes(1);
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

test('the sheet opens in the sheet variant of the shared modal layer', () => {
  render(<MobileActionSheet {...props} onClose={jest.fn()} />);
  settle();
  expect(screen.getByRole('dialog', { name: '影片操作' })).toHaveClass(
    'tm-modal-layer',
    'tm-modal-layer--sheet'
  );
});

test('pulling the header down with a finger closes, dragging with a mouse does not', () => {
  const closed = jest.fn();
  render(<MobileActionSheet {...props} onClose={closed} />);
  settle();
  const header = document.querySelector('.tm-action-sheet-header');
  if (!header) throw new Error('Missing header');
  pointer(header, 'pointerdown', 100, 'mouse');
  pointer(header, 'pointermove', 400, 'mouse');
  pointer(header, 'pointerup', 400, 'mouse');
  expect(closed).not.toHaveBeenCalled();
  pointer(header, 'pointerdown', 100, 'touch');
  pointer(header, 'pointermove', 200, 'touch');
  pointer(header, 'pointermove', 300, 'touch');
  pointer(header, 'pointerup', 300, 'touch');
  expect(closed).toHaveBeenCalledTimes(1);
});

test('with a confirm open over the sheet, each back press closes only the top layer', () => {
  const sheetClosed = jest.fn();
  function Stack({ confirmOpen }: { confirmOpen: boolean }) {
    const [sheetOpen, setSheetOpen] = useState(true);
    return (
      <>
        <MobileActionSheet
          {...props}
          isOpen={sheetOpen}
          onClose={() => {
            sheetClosed();
            setSheetOpen(false);
          }}
        />
        <ConfirmDialog
          isOpen={confirmOpen}
          title='删除记录？'
          message='不能恢复'
          onConfirm={jest.fn()}
          onCancel={confirmCancelled}
        />
      </>
    );
  }
  const confirmCancelled = jest.fn();
  const { rerender } = render(<Stack confirmOpen={false} />);
  settle();
  rerender(<Stack confirmOpen />);
  act(() => {
    expect(closeTopLayer()).toBe(true);
  });
  expect(confirmCancelled).toHaveBeenCalledTimes(1);
  expect(sheetClosed).not.toHaveBeenCalled();
  rerender(<Stack confirmOpen={false} />);
  expect(document.body.style.position).toBe('fixed');
  act(() => {
    expect(closeTopLayer()).toBe(true);
  });
  expect(sheetClosed).toHaveBeenCalledTimes(1);
  act(() => {
    jest.advanceTimersByTime(320);
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.position).toBe('');
  expect(closeTopLayer()).toBe(false);
});
