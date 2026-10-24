import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import AboutPage from './page';

jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

it('introduces only TongMuTV Plus on the website', () => {
  const { container } = render(<AboutPage />);
  expect(container.textContent).toContain('TongMuTV Plus');
  expect(container.textContent).not.toMatch(
    /MoonTV|LunaTV|原项目|上游|来源与致谢/i
  );
  expect(container.querySelector('a[href*="mtvpls"]')).toBeNull();
  const repository = screen.getByRole('link', {
    name: 'TongMuTV Plus 项目仓库（在新标签页打开）',
  });
  expect(repository.getAttribute('href')).toBe(
    'https://github.com/XYL333FYQ/TongMuTVPlus'
  );
  expect(repository.getAttribute('target')).toBe('_blank');
  expect(repository.getAttribute('rel')).toBe('noopener noreferrer');
});
