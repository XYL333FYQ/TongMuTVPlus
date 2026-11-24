'use client';

import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

interface RetryNoticeProps {
  message: ReactNode;
  /** 有重试时显示“重试加载”按钮 */
  onRetry?: () => void;
  retryLabel?: string;
  /** 其他操作（如“返回”“去设置”） */
  action?: ReactNode;
  className?: string;
}

/**
 * 全站唯一的加载失败提示：说明原因并提供重试，不把失败显示成“没有内容”。
 * 样式是 layout.css 的 tm-library-feedback。
 */
export default function RetryNotice({
  message,
  onRetry,
  retryLabel = '重试加载',
  action,
  className,
}: RetryNoticeProps) {
  return (
    <div
      className={
        className ? `tm-library-feedback ${className}` : 'tm-library-feedback'
      }
      role='alert'
    >
      <span>{message}</span>
      {onRetry ? (
        <button
          type='button'
          className='tm-btn tm-btn-secondary'
          onClick={onRetry}
        >
          <RefreshCw size={16} aria-hidden />
          {retryLabel}
        </button>
      ) : null}
      {action}
    </div>
  );
}
