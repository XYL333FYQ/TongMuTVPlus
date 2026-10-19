import { fireEvent, render, screen } from '@testing-library/react';

import EmptyState from './EmptyState';
import MediaActionButton from './MediaActionButton';
import ShelfChipButton from './ShelfChipButton';

test('an error is announced and its existing retry action remains usable', () => {
  const retry = jest.fn();
  render(
    <EmptyState
      tone='error'
      title='加载失败'
      description='请重试'
      action={<button onClick={retry}>重试</button>}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('请重试');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('ordinary action buttons preserve native disabled behavior without toggle semantics', () => {
  const action = jest.fn();
  render(
    <MediaActionButton disabled onClick={action}>
      清空记录
    </MediaActionButton>
  );
  const button = screen.getByRole('button', { name: '清空记录' });
  expect(button).toBeDisabled();
  expect(button).not.toHaveAttribute('aria-pressed');
  fireEvent.click(button);
  expect(action).not.toHaveBeenCalled();
});

test('shelf chips keep their existing toggle state, labels and callback', () => {
  const action = jest.fn();
  const { rerender } = render(
    <ShelfChipButton active={false} onClick={action} />
  );
  fireEvent.click(screen.getByRole('button', { name: '加入书架' }));
  expect(action).toHaveBeenCalledTimes(1);
  rerender(<ShelfChipButton active onClick={action} />);
  expect(screen.getByRole('button', { name: '移出书架' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});
