import type { Metadata } from 'next';

import MangaLayout from '@/components/manga/MangaLayout';

export const metadata: Metadata = { title: '漫画' };

export default function MangaAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MangaLayout>{children}</MangaLayout>;
}
