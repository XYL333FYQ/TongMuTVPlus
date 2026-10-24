'use client';

import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/primitives.css';
import '@/styles/layout.css';

// 根布局本身出错时的最后兜底（替换整个页面，所以要自带 html/body）
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang='zh-CN' className='dark'>
      <body>
        <main className='tm-empty' role='alert' style={{ minHeight: '100vh' }}>
          <h1 className='tm-empty-title'>网站暂时无法打开</h1>
          <p className='tm-empty-desc'>请稍后重试；如果一直这样，请联系站长</p>
          <button
            type='button'
            className='tm-btn tm-btn-primary'
            onClick={reset}
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
