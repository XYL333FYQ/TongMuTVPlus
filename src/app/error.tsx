'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

// 页面渲染出错时的兜底：说明情况并给出重试，而不是整页白屏。
// 根布局（含全站播放器）不受影响，正在播放的影片不会中断。
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('页面渲染出错:', error);
  }, [error]);

  return (
    <PageLayout>
      <PageContainer>
        <div className='tm-empty' role='alert'>
          <AlertTriangle className='tm-empty-icon' aria-hidden />
          <h1 className='tm-empty-title'>页面出了点问题</h1>
          <p className='tm-empty-desc'>
            可以重试一次；如果一直这样，请把出错时间告诉站长
            {error.digest ? `（编号 ${error.digest}）` : ''}
          </p>
          <div className='flex flex-wrap justify-center gap-3'>
            <button
              type='button'
              className='tm-btn tm-btn-primary'
              onClick={reset}
            >
              <RefreshCw size={16} aria-hidden />
              重试
            </button>
            <Link href='/' className='tm-btn tm-btn-secondary'>
              回到首页
            </Link>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
}
