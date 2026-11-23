import { act, render, screen } from '@testing-library/react';

import { usePullDownClose } from './usePullDownClose';

let clock = 0;

// jsdom 16 没有 PointerEvent：用 MouseEvent 带上 pointerType，React 照样当指针事件分发。
// 默认每个事件隔 100ms（慢慢拉），step 调小就是快速甩动
function pointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  clientY: number,
  pointerType: 'touch' | 'mouse' = 'touch',
  step = 100
) {
  clock += step;
  const event = new MouseEvent(type, { bubbles: true, clientY });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'timeStamp', { value: clock });
  act(() => {
    target.dispatchEvent(event);
  });
}

function Panel({ onClose }: { onClose: () => void }) {
  const pull = usePullDownClose(onClose);
  return (
    <div data-testid='panel' data-offset={pull.offset} {...pull.handlers}>
      <button type='button'>按钮</button>
    </div>
  );
}

test('a touch pulled past the threshold closes', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 180);
  expect(panel).toHaveAttribute('data-offset', '80');
  pointer(panel, 'pointermove', 260);
  pointer(panel, 'pointerup', 260);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a short touch pull springs back without closing', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 140);
  pointer(panel, 'pointerup', 140);
  expect(onClose).not.toHaveBeenCalled();
  expect(panel).toHaveAttribute('data-offset', '0');
});

test('dragging with a mouse never closes', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100, 'mouse');
  pointer(panel, 'pointermove', 400, 'mouse');
  pointer(panel, 'pointerup', 400, 'mouse');
  expect(onClose).not.toHaveBeenCalled();
  expect(panel).toHaveAttribute('data-offset', '0');
});

test('a pull that starts on a button is left to the button', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const button = screen.getByRole('button', { name: '按钮' });
  pointer(button, 'pointerdown', 100);
  pointer(button, 'pointermove', 400);
  pointer(button, 'pointerup', 400);
  expect(onClose).not.toHaveBeenCalled();
});

test('a cancelled touch springs back', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 300);
  pointer(panel, 'pointercancel', 300);
  expect(onClose).not.toHaveBeenCalled();
  expect(panel).toHaveAttribute('data-offset', '0');
});

test('a quick flick closes even when it is short', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 140, 'touch', 20);
  pointer(panel, 'pointerup', 140, 'touch', 5);
  expect(onClose).toHaveBeenCalledTimes(1);
});

function Toggle({
  enabled,
  onClose,
}: {
  enabled: boolean;
  onClose: () => void;
}) {
  const pull = usePullDownClose(onClose, { enabled });
  return (
    <div data-testid='panel' data-offset={pull.offset} {...pull.handlers} />
  );
}

test('a pull that closed the panel keeps its offset for the exit and starts from zero when reopened', () => {
  const onClose = jest.fn();
  const { rerender } = render(<Toggle enabled onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 200);
  pointer(panel, 'pointermove', 300);
  pointer(panel, 'pointerup', 300);
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<Toggle enabled={false} onClose={onClose} />);
  expect(panel).toHaveAttribute('data-offset', '200');
  rerender(<Toggle enabled onClose={onClose} />);
  expect(panel).toHaveAttribute('data-offset', '0');
});

test('losing the pointer capture ends the pull like a cancel', () => {
  const onClose = jest.fn();
  render(<Panel onClose={onClose} />);
  const panel = screen.getByTestId('panel');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 300);
  act(() => {
    panel.dispatchEvent(
      new MouseEvent('lostpointercapture', { bubbles: true })
    );
  });
  expect(panel).toHaveAttribute('data-offset', '0');
  pointer(panel, 'pointerdown', 100);
  pointer(panel, 'pointermove', 200);
  pointer(panel, 'pointermove', 300);
  pointer(panel, 'pointerup', 300);
  expect(onClose).toHaveBeenCalledTimes(1);
});
