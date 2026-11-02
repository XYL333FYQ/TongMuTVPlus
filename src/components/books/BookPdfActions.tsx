'use client';

import { Download, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { getPlatform } from '@/lib/platform';
import {
  nativeContentExportAvailable,
  saveNativeContent,
} from '@/lib/content-export';

import { LIBRARY_GHOST_BUTTON } from '@/components/media/library';
import { notify } from '@/components/feedback/AppDialogs';

export default function BookPdfActions({
  url,
  title,
  blob,
}: {
  url: string;
  title: string;
  blob?: Blob;
}) {
  const [nativeReader, setNativeReader] = useState(false);
  useEffect(() => {
    const update = () =>
      setNativeReader(
        getPlatform() === 'desktop' || nativeContentExportAvailable()
      );
    update();
    window.addEventListener('tm-content-export-ready', update);
    return () => window.removeEventListener('tm-content-export-ready', update);
  }, []);
  return (
    <div className='absolute bottom-4 right-4 flex flex-wrap items-center justify-end gap-2 max-sm:bottom-[calc(var(--tm-bottom-nav-height,0px)+1rem)]'>
      {!nativeReader && (
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
      <a
        href={url}
        download={`${title}.pdf`}
        className={LIBRARY_GHOST_BUTTON}
        onClick={async (event) => {
          if (!blob || !nativeContentExportAvailable()) return;
          event.preventDefault();
          try {
            await saveNativeContent(blob, `${title}.pdf`);
          } catch {
            notify('暂时无法保存文件，请保持此页面后重试。', 'error');
          }
        }}
      >
        <Download className='h-4 w-4' strokeWidth={2} />
        {nativeReader ? '保存后阅读' : '下载 PDF'}
      </a>
    </div>
  );
}
