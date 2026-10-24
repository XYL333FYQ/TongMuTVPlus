import type { Metadata } from 'next';

import './music.css';

import PageLayout from '@/components/PageLayout';

import MusicClient from './MusicClient';

export const metadata: Metadata = { title: '音乐' };

export default function MusicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageLayout activePath='/music'>
      <MusicClient>{children}</MusicClient>
    </PageLayout>
  );
}
