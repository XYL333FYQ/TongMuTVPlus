import { fireEvent, render, screen } from '@testing-library/react';

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
