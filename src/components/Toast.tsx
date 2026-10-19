'use client';

import { CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/feedback.css';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

export default function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const callback = useRef(onClose);
  callback.current = onClose;
  const dismiss = useRef<() => void>(() => undefined);

  useEffect(() => {
    let closing = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const close = () => {
      if (closing) return;
      closing = true;
      clearTimeout(timer);
      setIsVisible(false);
      closeTimer = setTimeout(() => callback.current?.(), 320);
    };
    dismiss.current = close;
    setIsVisible(true);
    const timer = setTimeout(close, duration);
    return () => {
      clearTimeout(timer);
      clearTimeout(closeTimer);
      dismiss.current = () => undefined;
    };
  }, [duration, message, type]);

  const icons = {
    success: <CheckCircle size={20} aria-hidden='true' />,
    error: <XCircle size={20} aria-hidden='true' />,
    info: <Info size={20} aria-hidden='true' />,
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='tm-toast'
      data-visible={isVisible}
      data-type={type}
      aria-hidden={!isVisible}
    >
      <div className='tm-toast-icon'>{icons[type]}</div>
      <div
        className='tm-toast-message'
        role={type === 'error' ? 'alert' : 'status'}
      >
        {message}
      </div>
      <button
        type='button'
        aria-label='关闭提示'
        tabIndex={isVisible ? 0 : -1}
        onClick={() => dismiss.current()}
        className='tm-feedback-close tm-press'
      >
        <X size={20} aria-hidden='true' />
      </button>
    </div>,
    document.body
  );
}
