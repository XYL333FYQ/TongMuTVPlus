'use client';

import { Download, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getPlatform } from '@/lib/platform';

import { LIBRARY_GHOST_BUTTON } from '@/components/media/library';

export default function BookPdfActions({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(getPlatform() === 'desktop');
  }, []);
  return (
    <div className='absolute bottom-4 right-4 flex flex-wrap items-center justify-end gap-2 max-sm:bottom-[calc(var(--tm-bottom-nav-height,0px)+1rem)]'>
      {!desktop && (
        <a
          href={url}
          target='_blank'
          rel='noreferrer'
          className={LIBRARY_GHOST_BUTTON}
        >
          <ExternalLink className='h-4 w-4' strokeWidth={2} />
          新窗口打开
        </a>
      )}
      <a href={url} download={`${title}.pdf`} className={LIBRARY_GHOST_BUTTON}>
        <Download className='h-4 w-4' strokeWidth={2} />
        {desktop ? '保存后阅读' : '下载 PDF'}
      </a>
    </div>
  );
}
