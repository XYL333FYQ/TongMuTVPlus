'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { logger } from '@/lib/logger';

import EmptyState from '@/components/feedback/EmptyState';
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
    logger.error('页面渲染出错:', error);
  }, [error]);

  return (
    <PageLayout>
      <PageContainer>
        <EmptyState
          role='alert'
          titleAs='h1'
          icon={<AlertTriangle size={24} />}
          title='页面出了点问题'
          description={
            '可以重试一次；如果一直这样，请把出错时间告诉站长' +
            (error.digest ? `（编号 ${error.digest}）` : '')
          }
          action={
            <>
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
            </>
          }
        />
      </PageContainer>
    </PageLayout>
  );
}
