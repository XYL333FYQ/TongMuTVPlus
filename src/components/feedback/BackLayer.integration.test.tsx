import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';

import { closeTopLayer } from '@/lib/shell-bridge';

import { ConfirmDialog } from './ConfirmDialog';
import ModalLayer from './ModalLayer';

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
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test('native shell consumes a close before the delayed React removal completes', () => {
  jest.useFakeTimers();
  function Example() {
    const [open, setOpen] = useState(true);
    return open ? (
      <ModalLayer
        label='测试弹层'
        onClose={() => {
          setTimeout(() => setOpen(false), 320);
        }}
      >
        内容
      </ModalLayer>
    ) : null;
  }
  render(<Example />);
  act(() => {
    expect(closeTopLayer()).toBe(true);
  });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  act(() => {
    expect(closeTopLayer()).toBe(true);
    jest.advanceTimersByTime(320);
  });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(closeTopLayer()).toBe(false);
});

test('pending destructive confirmation blocks shell return and native cancel', () => {
  const cancel = jest.fn();
  render(
    <ConfirmDialog
      isOpen
      title='删除确认'
      message='测试'
      onConfirm={() => new Promise<void>(() => undefined)}
      onCancel={cancel}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '确定' }));
  act(() => {
    expect(closeTopLayer()).toBe(true);
  });
  fireEvent(
    screen.getByRole('alertdialog'),
    new Event('cancel', { cancelable: true })
  );
  expect(cancel).not.toHaveBeenCalled();
});
