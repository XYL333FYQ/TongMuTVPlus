import { fireEvent, render, screen } from '@testing-library/react';

import ReaderDialog from './ReaderDialog';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = jest.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = jest.fn(function (
    this: HTMLDialogElement
  ) {
    this.removeAttribute('open');
  });
});

test('opens a named native modal and routes Escape and backdrop dismissal to the existing close callback', () => {
  const close = jest.fn();
  render(
    <ReaderDialog label='阅读设置' onClose={close}>
      <button>完成</button>
    </ReaderDialog>
  );
  const dialog = screen.getByRole('dialog', { name: '阅读设置' });
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '完成' }));
  expect(close).not.toHaveBeenCalled();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.click(dialog);
  expect(close).toHaveBeenCalledTimes(2);
});
