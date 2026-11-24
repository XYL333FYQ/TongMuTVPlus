import { act, fireEvent, render, screen } from '@testing-library/react';

import DetailShell from './DetailShell';

let tier = 'wide';
jest.mock('@/hooks/useDeviceTier', () => ({
  useDeviceTier: () => tier,
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      media,
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    }),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  tier = 'wide';
  jest.useRealTimers();
});

const panel = () =>
  document.querySelector<HTMLElement>('.tm-detail-panel') as HTMLElement;

test('tablet and desktop: centred dialog of the shared modal layer', () => {
  render(
    <DetailShell title='影片' onClose={jest.fn()}>
      <p>简介</p>
    </DetailShell>
  );
  const dialog = screen.getByRole('dialog', { name: '影片' });
  expect(dialog).toHaveClass('tm-modal-layer', 'tm-detail-layer');
  expect(dialog).not.toHaveClass('tm-modal-layer--sheet');
  expect(screen.queryByRole('button', { name: '下拉关闭详情' })).toBeNull();
});

test('phone portrait: bottom sheet with a pull handle and the footer', () => {
  tier = 'phone';
  render(
    <DetailShell title='影片' onClose={jest.fn()} footer={<p>底部操作</p>}>
      <p>简介</p>
    </DetailShell>
  );
  expect(screen.getByRole('dialog', { name: '影片' })).toHaveClass(
    'tm-modal-layer--sheet'
  );
  expect(
    screen.getByRole('button', { name: '下拉关闭详情' })
  ).toBeInTheDocument();
  expect(screen.getByText('底部操作')).toBeInTheDocument();
});

test('enters, then closes only after its exit has played', () => {
  jest.useFakeTimers();
  const onClose = jest.fn();
  render(
    <DetailShell title='影片' onClose={onClose}>
      <p>简介</p>
    </DetailShell>
  );
  expect(panel()).toHaveAttribute('data-state', 'entering');
  act(() => {
    jest.advanceTimersByTime(20);
  });
  expect(panel()).toHaveAttribute('data-state', 'open');
  fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
  expect(panel()).toHaveAttribute('data-state', 'closing');
  expect(onClose).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the parent hiding it plays the exit too', () => {
  jest.useFakeTimers();
  const { rerender } = render(
    <DetailShell title='影片' onClose={jest.fn()} visible>
      <p>简介</p>
    </DetailShell>
  );
  act(() => {
    jest.advanceTimersByTime(20);
  });
  rerender(
    <DetailShell title='影片' onClose={jest.fn()} visible={false}>
      <p>简介</p>
    </DetailShell>
  );
  expect(panel()).toHaveAttribute('data-state', 'closing');
});
