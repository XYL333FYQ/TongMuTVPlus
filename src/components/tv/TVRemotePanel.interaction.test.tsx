import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import TVRemotePanel from './TVRemotePanel';

const originalFetch = global.fetch;
const commands: Array<{ command: { key: string; repeat: boolean } }> = [];
let fakeTimers = false;

function useFakeTime() {
  jest.useFakeTimers();
  fakeTimers = true;
}

function useRealTime() {
  if (fakeTimers) {
    jest.clearAllTimers();
    jest.useRealTimers();
    fakeTimers = false;
  }
}

beforeEach(() => {
  useRealTime();
  commands.length = 0;
  delete document.documentElement.dataset.tmReducedMotion;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn((media: string) => ({
      media,
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  global.fetch = jest.fn().mockImplementation(async (url, init) => {
    if (String(url).endsWith('/key')) commands.push(JSON.parse(init.body));
    return {
      ok: true,
      json: async () => ({
        success: true,
        devices: [
          { deviceId: 'fixture', deviceName: '验收电视', currentPath: '/tv' },
        ],
      }),
    };
  });
});

afterEach(() => {
  useRealTime();
  delete document.documentElement.dataset.tmReducedMotion;
  global.fetch = originalFetch;
});

async function openPanel(onClose = jest.fn()) {
  const props = { isOpen: true, mounted: true, onClose };
  const view = render(<TVRemotePanel {...props} />);
  await screen.findByRole('button', { name: /验收电视/ });
  return { ...view, props, onClose };
}

test('keyboard activation sends one direction command without requiring a pointer', async () => {
  await openPanel();
  fireEvent.click(screen.getByRole('button', { name: '上' }), {
    detail: 0,
  });
  await waitFor(() => expect(commands).toHaveLength(1));
  expect(commands[0].command).toEqual({ key: 'up', repeat: false });
});

test('pointer activation does not send a second command for its compatibility click', async () => {
  await openPanel();
  const up = screen.getByRole('button', { name: '上' });
  fireEvent.pointerDown(up);
  fireEvent.pointerUp(up);
  fireEvent.click(up, { detail: 1 });
  await waitFor(() => expect(commands).toHaveLength(1));
  expect(commands[0].command).toEqual({ key: 'up', repeat: false });
});

test('dialog is named, starts on close, wraps Tab and restores its connected trigger', async () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const { rerender, props } = await openPanel();
  expect(screen.getByRole('dialog', { name: '电视遥控器' })).toHaveAttribute(
    'aria-modal',
    'true'
  );
  const close = screen.getByRole('button', { name: '关闭遥控器' });
  const last = screen.getByRole('button', { name: '清空' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(last).toHaveFocus();
  expect(fireEvent.keyDown(last, { key: 'Tab', ctrlKey: true })).toBe(true);
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: 'Tab' });
  expect(close).toHaveFocus();
  rerender(<TVRemotePanel {...props} isOpen={false} />);
  expect(trigger).toHaveFocus();
  trigger.remove();
});

test('close waits for exit, suppresses repeated dismissal and stops commands immediately', async () => {
  const { onClose } = await openPanel();
  useFakeTime();
  const close = screen.getByRole('button', { name: '关闭遥控器' });
  fireEvent.click(close);
  fireEvent.click(close);
  fireEvent.click(screen.getByRole('button', { name: '上' }), {
    detail: 0,
  });
  expect(onClose).not.toHaveBeenCalled();
  expect(commands).toHaveLength(0);
  act(() => jest.advanceTimersByTime(319));
  expect(onClose).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('reduced motion closes in 120ms and unmount cancels pending dismissal', async () => {
  document.documentElement.dataset.tmReducedMotion = 'true';
  const { onClose, unmount } = await openPanel();
  useFakeTime();
  fireEvent.click(screen.getByRole('button', { name: '关闭遥控器' }));
  expect(onClose).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(119));
  expect(onClose).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
  useRealTime();
  const second = await openPanel();
  useFakeTime();
  fireEvent.click(screen.getByRole('button', { name: '关闭遥控器' }));
  second.unmount();
  act(() => jest.advanceTimersByTime(1000));
  expect(second.onClose).not.toHaveBeenCalled();
});

test('native cancel uses the latest callback without stealing in-panel focus on rerender', async () => {
  const { props, onClose, rerender } = await openPanel();
  const textarea = screen.getByRole('textbox', { name: '发送到电视的文字' });
  textarea.focus();
  const latest = jest.fn();
  rerender(<TVRemotePanel {...props} onClose={latest} />);
  expect(textarea).toHaveFocus();
  useFakeTime();
  fireEvent(
    screen.getByRole('dialog', { name: '电视遥控器' }),
    new Event('cancel', { cancelable: true })
  );
  expect(latest).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(320));
  expect(latest).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

test('fallback focus skips the hidden account menu used by the other breakpoint', async () => {
  const hidden = document.createElement('button');
  const visible = document.createElement('button');
  for (const button of [hidden, visible]) {
    button.setAttribute('aria-label', '账号菜单');
    document.body.append(button);
  }
  hidden.style.display = 'none';
  Object.defineProperty(visible, 'getClientRects', {
    value: () => [{ x: 0, y: 0, width: 44, height: 44 }],
  });
  const { props, rerender } = await openPanel();
  rerender(<TVRemotePanel {...props} isOpen={false} />);
  expect(visible).toHaveFocus();
  hidden.remove();
  visible.remove();
});
