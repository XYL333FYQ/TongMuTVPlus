import { render } from '@testing-library/react';

import { useNotificationTargetFocus } from './useNotificationTargetFocus';

function Target({ navigationKey }: { navigationKey: string }) {
  const ref = useNotificationTargetFocus<HTMLDivElement>(
    'same-record',
    true,
    navigationKey
  );
  return (
    <div ref={ref} tabIndex={-1}>
      记录
    </div>
  );
}

test('clicking the same notification again scrolls and focuses the same record again', () => {
  const rects = jest
    .spyOn(HTMLElement.prototype, 'getClientRects')
    .mockReturnValue([{}] as unknown as DOMRectList);
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn();
  const view = render(<Target navigationKey='first-click' />);
  view.rerender(<Target navigationKey='second-click' />);
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
  view.unmount();
  rects.mockRestore();
  HTMLElement.prototype.scrollIntoView = originalScroll;
});
