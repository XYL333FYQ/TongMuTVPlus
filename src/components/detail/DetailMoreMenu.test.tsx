import { fireEvent, render, screen } from '@testing-library/react';

import DetailMoreMenu from './DetailMoreMenu';

test('an existing gallery request returning no images hides its entry without a probe', () => {
  const items = [{ label: '照片墙', action: jest.fn() }];
  const view = render(
    <DetailMoreMenu
      items={items}
      gallery={{
        key: 'movie:1',
        loading: true,
        total: 0,
        error: null,
        open: true,
      }}
    />
  );
  view.rerender(
    <DetailMoreMenu
      items={items}
      gallery={{
        key: 'movie:1',
        loading: false,
        total: 0,
        error: null,
        open: true,
      }}
    />
  );
  expect(
    screen.queryByRole('button', { name: '更多' })
  ).not.toBeInTheDocument();
  view.rerender(
    <DetailMoreMenu
      items={items}
      gallery={{
        key: 'movie:2',
        loading: false,
        total: 0,
        error: null,
        open: false,
      }}
    />
  );
  expect(screen.getByRole('button', { name: '更多' })).toBeInTheDocument();
});

test('Tab dismisses the menu and moves to the next dialog control', () => {
  render(
    <dialog open>
      <DetailMoreMenu items={[{ label: '照片墙', action: jest.fn() }]} />
      <button>关闭详情</button>
    </dialog>
  );
  fireEvent.click(screen.getByRole('button', { name: '更多' }));
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '照片墙' }), {
    key: 'Tab',
  });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '关闭详情' })).toHaveFocus();
});

test('no usable items means no more button', () => {
  render(<DetailMoreMenu items={[]} />);
  expect(
    screen.queryByRole('button', { name: '更多' })
  ).not.toBeInTheDocument();
});

test('keyboard navigation skips disabled items and Escape stays within the menu', () => {
  const parentKeys = jest.fn(),
    action = jest.fn();
  render(
    <div onKeyDown={parentKeys}>
      <DetailMoreMenu
        items={[
          { label: '切换数据来源', action },
          { label: '照片墙', action, disabled: true },
          { label: '在新窗口打开', action },
        ]}
      />
    </div>
  );
  const more = screen.getByRole('button', { name: '更多' });
  fireEvent.click(more);
  const source = screen.getByRole('menuitem', { name: '切换数据来源' });
  expect(source).toHaveFocus();
  fireEvent.keyDown(source, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: '在新窗口打开' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(more).toHaveFocus();
  expect(parentKeys).not.toHaveBeenCalled();
  fireEvent.click(more);
  fireEvent.click(screen.getByRole('menuitem', { name: '切换数据来源' }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
