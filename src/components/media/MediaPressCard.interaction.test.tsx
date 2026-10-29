import { fireEvent, render, screen } from '@testing-library/react';

import MediaPressCard from './MediaPressCard';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('./MediaCard', () => ({
  __esModule: true,
  default: ({ href, item, overlayAction }: any) => (
    <div>
      <a href={href}>{item.title}</a>
      {overlayAction}
    </div>
  ),
}));
jest.mock('@/components/feedback/MobileActionSheet', () => ({
  __esModule: true,
  default: ({ isOpen, actions, onClose }: any) =>
    isOpen ? (
      <div role='dialog' aria-label='作品操作'>
        {actions.map((action: any) => (
          <button key={action.id} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
        <button onClick={onClose}>关闭</button>
      </div>
    ) : null,
}));
jest.mock('@/components/feedback/ImageViewer', () => () => null);

test('shelf actions have a visible button independent of the book link and preserve the existing action', () => {
  const remove = jest.fn();
  render(
    <MediaPressCard
      item={{ key: 'book', title: '长书名' }}
      title='长书名'
      href='/books/detail?bookId=1'
      actions={[
        { id: 'remove', label: '移出书架', icon: <span />, onClick: remove },
      ]}
    />
  );
  const trigger = screen.getByRole('button', { name: '长书名的更多操作' });
  expect(screen.getByRole('link')).not.toContainElement(trigger);
  expect(trigger.closest('[data-button]')).not.toBeNull();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '移出书架' }));
  expect(remove).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
