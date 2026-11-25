'use client';

import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/primitives.css';
import '@/styles/primitives-chip.css';
import '@/styles/primitives-theme-emblem.css';
import '@/styles/primitives-motion.css';
import '@/styles/layout.css';
import '@/styles/layout-section.css';
import '@/styles/layout-public.css';

import EmptyState from '@/components/feedback/EmptyState';

// 根布局本身出错时的最后兜底（替换整个页面，所以要自带 html/body）
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang='zh-CN' className='dark'>
      <body>
        <main className='tm-empty-page'>
          <EmptyState
            role='alert'
            titleAs='h1'
            title='网站暂时无法打开'
            description='请稍后重试；如果一直这样，请联系站长'
            action={
              <button
                type='button'
                className='tm-btn tm-btn-primary'
                onClick={reset}
              >
                重试
              </button>
            }
          />
        </main>
      </body>
    </html>
  );
}
