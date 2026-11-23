import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { closeTopLayer } from '@/lib/shell-bridge';

import ModalLayer, { type ModalVariant } from './ModalLayer';

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
  fireEvent.click(screen.getByRole('dialog'));
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('内容'));
  expect(onClose).toHaveBeenCalledTimes(2);
});
