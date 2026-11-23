import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { useEffect, useRef } from 'react';

import { closeTopLayer } from '@/lib/shell-bridge';

import ModalLayer, { type ModalVariant } from './ModalLayer';
import Toast from './Toast';

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});
beforeEach(() => {
  document.body.removeAttribute('style');
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test('the default variant keeps exactly the class names it had before', () => {
  render(
    <ModalLayer label='公告' onClose={() => undefined} className='extra'>
      内容
    </ModalLayer>
  );
  expect(screen.getByRole('dialog').className).toBe('tm-modal-layer extra');
});

test.each<ModalVariant>(['sheet', 'drawer', 'confirm', 'viewer'])(
  'variant %s adds its own modifier class',
  (variant) => {
    render(
      <ModalLayer label='面板' onClose={() => undefined} variant={variant}>
        内容
      </ModalLayer>
    );
    expect(screen.getByRole('dialog')).toHaveClass(
      'tm-modal-layer',
      `tm-modal-layer--${variant}`
    );
  }
);

test('opening locks the page scroll and closing unlocks it', () => {
  const { unmount } = render(
    <ModalLayer label='公告' onClose={() => undefined}>
      内容
    </ModalLayer>
  );
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('');
});

test('two stacked layers keep the page locked until the lower one closes', () => {
  const lower = render(
    <ModalLayer label='下层' onClose={() => undefined}>
      下层
    </ModalLayer>
  );
  const upper = render(
    <ModalLayer label='上层' onClose={() => undefined}>
      上层
    </ModalLayer>
  );
  upper.unmount();
  expect(document.body.style.overflow).toBe('hidden');
  lower.unmount();
  expect(document.body.style.overflow).toBe('');
});

test('the back key and the backdrop close it', () => {
  const onClose = jest.fn();
  render(
    <ModalLayer label='公告' onClose={onClose}>
      <p>内容</p>
    </ModalLayer>
  );
  act(() => {
    expect(closeTopLayer()).toBe(true);
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(screen.getByRole('dialog'));
  fireEvent.click(screen.getByRole('dialog'));
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('内容'));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('closing returns focus to the control that opened it', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  try {
    const { unmount } = render(
      <ModalLayer label='公告' onClose={() => undefined}>
        <button type='button'>里面</button>
      </ModalLayer>
    );
    screen.getByRole('button', { name: '里面' }).focus();
    unmount();
    expect(trigger).toHaveFocus();
  } finally {
    trigger.remove();
  }
});

test('Tab wraps inside the layer in both directions', () => {
  render(
    <ModalLayer label='公告' onClose={() => undefined}>
      <button type='button'>一</button>
      <button type='button' disabled>
        停用
      </button>
      <button type='button'>二</button>
    </ModalLayer>
  );
  const first = screen.getByRole('button', { name: '一' });
  const last = screen.getByRole('button', { name: '二' });
  last.focus();
  expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
  expect(first).toHaveFocus();
  expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
  expect(last).toHaveFocus();
});

test('Escape inside the layer never reaches page-level key listeners', () => {
  const underlying = jest.fn();
  document.addEventListener('keydown', underlying);
  try {
    render(
      <ModalLayer label='公告' onClose={() => undefined}>
        <button type='button'>里面</button>
      </ModalLayer>
    );
    fireEvent.keyDown(screen.getByRole('button', { name: '里面' }), {
      key: 'Escape',
    });
    expect(underlying).not.toHaveBeenCalled();
  } finally {
    document.removeEventListener('keydown', underlying);
  }
});

test('an alert layer carries its role and description', () => {
  render(
    <ModalLayer
      label='删除？'
      onClose={() => undefined}
      role='alertdialog'
      describedBy='why'
    >
      <p id='why'>不能恢复</p>
    </ModalLayer>
  );
  const dialog = screen.getByRole('alertdialog', { name: '删除？' });
  expect(dialog).toHaveAccessibleDescription('不能恢复');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
});

test('the backdrop ignores a click whose press began elsewhere', () => {
  const onClose = jest.fn();
  render(
    <ModalLayer label='菜单' onClose={onClose}>
      <p>内容</p>
    </ModalLayer>
  );
  const dialog = screen.getByRole('dialog');
  fireEvent.click(dialog);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByText('内容'));
  fireEvent.click(dialog);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.pointerDown(dialog);
  fireEvent.click(dialog);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the layer content exists when the caller’s effects run in the same commit', () => {
  const seen: Array<HTMLElement | null> = [];
  function Caller() {
    const inner = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
      seen.push(inner.current);
    }, []);
    return (
      <ModalLayer label='公告' onClose={() => undefined}>
        <p ref={inner}>内容</p>
      </ModalLayer>
    );
  }
  render(<Caller />);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toBeInstanceOf(HTMLParagraphElement);
});

test('Escape on a layer opened from inside another layer closes only the inner one', () => {
  const outer = jest.fn();
  const inner = jest.fn();
  render(
    <ModalLayer label='成员' onClose={outer}>
      <ModalLayer label='管理成员' onClose={inner}>
        内容
      </ModalLayer>
    </ModalLayer>
  );
  fireEvent(
    screen.getByRole('dialog', { name: '管理成员' }),
    new Event('cancel', { cancelable: true })
  );
  expect(inner).toHaveBeenCalledTimes(1);
  expect(outer).not.toHaveBeenCalled();
});

test('variant rules style the layer’s own panels, never the guests that portal into it', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'src/styles/modal-layer.css'),
    'utf8'
  );
  // 任何“弹窗层的子元素”规则都必须排除挂进来的提示条、下拉菜单
  expect(css).not.toMatch(/>\s*\*/);
  expect(css).toMatch(/:where\(:not\(\[data-tm-layer-guest\]\)\)/);
});

test('a toast shown over an open layer joins it as a guest', async () => {
  render(
    <ModalLayer label='设置' onClose={() => undefined} variant='drawer'>
      <p>面板</p>
      <Toast message='已备份' />
    </ModalLayer>
  );
  // 提示条看到弹窗打开（open 属性变化）后搬进去
  await waitFor(() =>
    expect(screen.getByText('已备份').closest('.tm-toast')?.parentElement).toBe(
      screen.getByRole('dialog')
    )
  );
  expect(screen.getByText('已备份').closest('.tm-toast')).toHaveAttribute(
    'data-tm-layer-guest'
  );
});
