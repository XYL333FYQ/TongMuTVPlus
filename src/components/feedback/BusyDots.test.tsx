import { render } from '@testing-library/react';

import BusyDots from './BusyDots';

test('three dots, hidden from screen readers, sized to the icon they replace', () => {
  const { container } = render(<BusyDots size={22} />);
  const busy = container.querySelector<HTMLElement>('.tm-busy');
  expect(busy).toHaveAttribute('aria-hidden', 'true');
  expect(busy?.children).toHaveLength(3);
  expect(busy?.style.getPropertyValue('--tm-busy-dot')).toBe('6px');
  expect(busy?.style.getPropertyValue('--tm-busy-gap')).toBe('4px');
});

test('small icons still get readable dots', () => {
  const { container } = render(<BusyDots size={12} />);
  const busy = container.querySelector<HTMLElement>('.tm-busy');
  expect(busy?.style.getPropertyValue('--tm-busy-dot')).toBe('4px');
  expect(busy?.style.getPropertyValue('--tm-busy-gap')).toBe('2px');
});
