import type { Metadata } from 'next';

import BooksLayout from '@/components/books/BooksLayout';

export const metadata: Metadata = { title: '书籍' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <BooksLayout>{children}</BooksLayout>;
}
