import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import BooksLayout from './BooksLayout';

jest.mock('next/navigation', () => ({
  usePathname: () => '/books/read',
  useSearchParams: () => new URLSearchParams('sourceId=qa&bookId=qa'),
}));
jest.mock('@/components/SiteProvider', () => ({
  useSite: () => ({ siteName: '站点' }),
}));
jest.mock('@/components/media/MediaShell', () => ({
  __esModule: true,
  default: ({
    reader,
    children,
  }: {
    reader?: { actions: ReactNode };
    children: ReactNode;
  }) => (
    <div>
      {reader?.actions}
      {children}
    </div>
  ),
}));

test('PDF uses its browser toolbar while EPUB retains the existing chapter and settings controls', () => {
  render(
    <BooksLayout>
      <p>阅读区域</p>
    </BooksLayout>
  );
  expect(screen.getByRole('button', { name: '目录' })).toBeInTheDocument();
  fireEvent(
    window,
    new CustomEvent('books-read-update-header', {
      detail: { title: 'PDF', format: 'pdf' },
    })
  );
  expect(
    screen.queryByRole('button', { name: '目录' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: '更多' })
  ).not.toBeInTheDocument();
  expect(screen.getByText('阅读区域')).toBeInTheDocument();
  fireEvent(
    window,
    new CustomEvent('books-read-update-header', {
      detail: { title: 'EPUB', format: 'epub' },
    })
  );
  expect(screen.getByRole('button', { name: '目录' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '更多' })).toBeInTheDocument();
});
