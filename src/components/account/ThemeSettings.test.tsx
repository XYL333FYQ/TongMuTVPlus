import { fireEvent, render, screen } from '@testing-library/react';

import ThemeSettings from '@/components/account/ThemeSettings';

const mockSetTheme = jest.fn();
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: mockSetTheme }),
}));
jest.mock('@/lib/theme-transition', () => ({
  changeThemeWithTransition: (theme: string, apply: (value: string) => void) =>
    apply(theme),
}));

beforeEach(() => {
  mockSetTheme.mockClear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
});

test('three theme choices replace the select and support arrow navigation', () => {
  const { container } = render(<ThemeSettings />);
  expect(container.querySelector('select')).toBeNull();
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  const dark = screen.getByRole('radio', { name: '深色' });
  expect(dark).toHaveAttribute('aria-checked', 'true');
  fireEvent.keyDown(dark, { key: 'ArrowRight' });
  expect(screen.getByRole('radio', { name: '浅色' })).toHaveFocus();
  expect(mockSetTheme).toHaveBeenLastCalledWith('light');
  fireEvent.click(screen.getByRole('radio', { name: '跟随系统' }));
  expect(mockSetTheme).toHaveBeenLastCalledWith('system');
});
