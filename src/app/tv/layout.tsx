import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import '@/components/tv/tv.css';

import { isTVModeEnabled } from '@/lib/tv-mode';

import TVRemoteReceiver from '@/components/tv/TVRemoteReceiver';

export const metadata = {
  title: '电视',
};

export default function Layout({ children }: { children: ReactNode }) {
  if (!isTVModeEnabled()) {
    notFound();
  }

  return (
    <>
      {children}
      <TVRemoteReceiver />
    </>
  );
}
