'use client';

import { RefreshCw } from 'lucide-react';

interface RetryNoticeProps {
  message: string;
  onRetry: () => void;
}

// 与片库一致的加载失败提示：说明原因并提供重试，不把失败显示成“没有内容”。
// 样式复用 layout.css 的 tm-library-feedback。
export default function RetryNotice({ message, onRetry }: RetryNoticeProps) {
  return (
    <div className='tm-library-feedback' role='alert'>
      <span>{message}</span>
      <button
        type='button'
        className='tm-btn tm-btn-secondary'
        onClick={onRetry}
      >
        <RefreshCw size={16} aria-hidden />
        重试加载
      </button>
    </div>
  );
}
