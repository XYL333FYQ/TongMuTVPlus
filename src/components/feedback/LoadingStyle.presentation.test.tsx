import { fireEvent, render, screen } from '@testing-library/react';

import LoadingStyle, { LoadingErrorStyle } from '@/components/feedback/LoadingStyle';

const steps = [
  { label: '加载', icon: <span>加载图标</span> },
  { label: '片源', icon: <span>片源图标</span> },
];

test('all loading and error presentations retain the fixed cinema palette on a player', () => {
  const props = {
    steps,
    activeStepIdx: 0,
    message: '正在加载',
    legacy: <span>原有内容</span>,
    onDark: true,
  };
  const { container, rerender } = render(<LoadingStyle {...props} />);
  for (const node of Array.from(
    container.querySelectorAll(
      '.mtv-load-classic,.mtv-load-grid,.mtv-load-talisman'
    )
  ))
    expect(node).toHaveClass('mtv-on-dark');
  rerender(<LoadingErrorStyle {...props} />);
  for (const node of Array.from(
    container.querySelectorAll(
      '.mtv-err-legacy,.mtv-load-grid,.mtv-load-talisman'
    )
  ))
    expect(node).toHaveClass('mtv-on-dark');
});

test('the original legacy content and its action survive stage updates', () => {
  const onRetry = jest.fn();
  const props = {
    steps,
    activeStepIdx: 0,
    message: '正在加载',
    legacy: <button onClick={onRetry}>原有重试</button>,
  };
  const { rerender } = render(<LoadingStyle {...props} />);
  const original = screen.getByRole('button', { name: '原有重试' });
  rerender(<LoadingStyle {...props} activeStepIdx={1} />);
  expect(screen.getByRole('button', { name: '原有重试' })).toBe(original);
  fireEvent.click(original);
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('stage clamping and the existing progress percentage remain intact', () => {
  const props = {
    steps,
    activeStepIdx: -2,
    message: '正在加载',
    legacy: <span>原有内容</span>,
  };
  const { container, rerender } = render(<LoadingStyle {...props} />);
  expect(container.querySelector('.mtv-tal-icon')).toHaveTextContent(
    '加载图标'
  );
  expect(container.querySelector('.mtv-tal-bar i')).toHaveStyle({
    width: '50%',
  });
  rerender(<LoadingStyle {...props} activeStepIdx={9} />);
  expect(container.querySelector('.mtv-tal-icon')).toHaveTextContent(
    '片源图标'
  );
  expect(container.querySelector('.mtv-tal-bar i')).toHaveStyle({
    width: '100%',
  });
  rerender(<LoadingStyle {...props} activeStepIdx={1} onDark />);
  expect(container.querySelector('.mtv-tal-bar')).not.toBeInTheDocument();
});
