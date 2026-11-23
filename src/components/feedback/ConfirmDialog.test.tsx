import { act, fireEvent, render, screen } from '@testing-library/react';

import { lockScroll } from '@/lib/scroll-lock';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

function openDialog() {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const props = {
    isOpen: true,
    title: '确认删除',
    message: '删除选中的下载记录？',
    confirmText: '删除',
    onConfirm,
    onCancel,
  };
  return {
    ...render(<ConfirmDialog {...props} />),
    props,
    onConfirm,
    onCancel,
  };
}

test('confirmation is named and described, initially focuses cancel and returns focus when closed', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const { rerender, props } = openDialog();
  const dialog = screen.getByRole('alertdialog', { name: '确认删除' });
  expect(dialog).toHaveAccessibleDescription('删除选中的下载记录？');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  rerender(<ConfirmDialog {...props} isOpen={false} />);
  expect(trigger).toHaveFocus();
  trigger.remove();
});

test('Escape cancel and background clicks never confirm, content clicks leave dialog open', () => {
  const { onConfirm, onCancel } = openDialog();
  const dialog = screen.getByRole('alertdialog', { name: '确认删除' });
  fireEvent.click(screen.getByText('删除选中的下载记录？'));
  expect(onCancel).not.toHaveBeenCalled();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(dialog);
  fireEvent.click(dialog);
  expect(onCancel).toHaveBeenCalledTimes(2);
  expect(onConfirm).not.toHaveBeenCalled();
});

test('Tab wraps within the dialog, and confirming still calls the original action', () => {
  const { onConfirm, onCancel } = openDialog();
  const close = screen.getByRole('button', { name: '关闭确认' });
  const confirm = screen.getByRole('button', { name: '删除' });
  confirm.focus();
  fireEvent.keyDown(confirm, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(confirm).toHaveFocus();
  fireEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
});

test('closed confirmation is absent', () => {
  const { rerender, props } = openDialog();
  rerender(<ConfirmDialog {...props} isOpen={false} />);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('an async confirmation cannot run twice while it is still pending', async () => {
  let finish: () => void = () => undefined;
  const onConfirm = jest.fn(
    () => new Promise<void>((resolve) => (finish = resolve))
  );
  render(
    <ConfirmDialog
      isOpen
      title='清空记录'
      message='清空全部播放记录？'
      confirmText='清空'
      onConfirm={onConfirm}
      onCancel={jest.fn()}
    />
  );
  const confirm = screen.getByRole('button', { name: '清空' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(confirm).toBeDisabled();
  await act(async () => finish());
  expect(confirm).not.toBeDisabled();
});

test('renders inside the shared modal layer as the confirm variant', () => {
  openDialog();
  const dialog = screen.getByRole('alertdialog', { name: '确认删除' });
  expect(dialog.tagName).toBe('DIALOG');
  expect(dialog).toHaveClass('tm-modal-layer', 'tm-modal-layer--confirm');
});

test('the confirm button comes after cancel', () => {
  openDialog();
  const footer = screen.getByRole('button', { name: '取消' }).parentElement;
  const labels = Array.from(footer?.querySelectorAll('button') ?? []).map(
    (button) => button.textContent
  );
  expect(labels).toEqual(['取消', '删除']);
});

test('closing a confirm opened from a sheet keeps the page locked', () => {
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
  const unlockLower = lockScroll();
  try {
    const { rerender, props } = openDialog();
    rerender(<ConfirmDialog {...props} isOpen={false} />);
    expect(document.body.style.position).toBe('fixed');
  } finally {
    unlockLower();
  }
  expect(document.body.style.position).toBe('');
});
