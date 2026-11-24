import { fireEvent, render, screen } from '@testing-library/react';

import SideLayer from './SideLayer';

beforeAll(() => {
  HTMLDialogElement.prototype.show = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

test('详情侧栏是非模态对话框，抽屉是页面旁边的区域；都挂到 body、不锁页面', () => {
  render(
    <div style={{ transform: 'translateX(0)' }}>
      <SideLayer label='详情' onClose={jest.fn()}>
        <p>内容</p>
      </SideLayer>
      <SideLayer semantics='region' label='AI影视助手' onClose={jest.fn()}>
        <p>助手</p>
      </SideLayer>
    </div>
  );
  const dialog = screen.getByRole('dialog', { name: '详情' });
  expect(dialog).toHaveAttribute('aria-modal', 'false');
  expect(dialog.parentElement).toBe(document.body);
  expect(
    screen.getByRole('complementary', { name: 'AI影视助手' })
  ).toBeTruthy();
  expect(document.body.style.position).toBe('');
});

test('Esc 只关最上面、开着的那一层；上面有模态弹窗时不关', () => {
  const lower = jest.fn();
  const upper = jest.fn();
  const closed = jest.fn();
  const { rerender } = render(
    <>
      <SideLayer label='下' onClose={lower}>
        <p />
      </SideLayer>
      <SideLayer label='上' onClose={upper}>
        <p />
      </SideLayer>
      <SideLayer open={false} semantics='region' label='收着' onClose={closed}>
        <p />
      </SideLayer>
    </>
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(upper).toHaveBeenCalledTimes(1);
  expect(lower).not.toHaveBeenCalled();
  expect(closed).not.toHaveBeenCalled();

  const modal = document.createElement('dialog');
  modal.setAttribute('open', '');
  modal.setAttribute('aria-modal', 'true');
  document.body.appendChild(modal);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(upper).toHaveBeenCalledTimes(1);
  modal.remove();
  rerender(<></>);
});

test('一直挂着的抽屉：打开时记下触发按钮，收起时把焦点还回去', () => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  const inside = { current: null as HTMLButtonElement | null };
  const view = (open: boolean) => (
    <SideLayer
      open={open}
      semantics='region'
      label='AI影视助手'
      initialFocus={inside}
      onClose={jest.fn()}
    >
      <button
        ref={(node) => {
          inside.current = node;
        }}
      >
        关闭
      </button>
    </SideLayer>
  );
  const { rerender } = render(view(false));
  trigger.focus();
  rerender(view(true));
  expect(document.activeElement).toBe(inside.current);
  rerender(view(false));
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
