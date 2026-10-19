'use client';

import { X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ErrorInfo {
  id: string;
  message: string;
  timestamp: number;
}

export function GlobalErrorIndicator() {
  const [currentError, setCurrentError] = useState<ErrorInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const currentErrorRef = useRef<ErrorInfo | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    clearExitTimer();
    setIsClosing(true);
    setIsReplacing(false);

    exitTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setCurrentError(null);
      setIsClosing(false);
      exitTimerRef.current = null;
    }, 300);
  }, [clearCloseTimer, clearExitTimer]);

  useEffect(() => {
    currentErrorRef.current = currentError;
  }, [currentError]);

  useEffect(() => {
    // 监听自定义错误事件
    const handleError = (event: CustomEvent) => {
      const { message } = event.detail;
      const newError: ErrorInfo = {
        id: Date.now().toString(),
        message,
        timestamp: Date.now(),
      };

      clearCloseTimer();
      clearExitTimer();
      setIsClosing(false);
      setIsVisible(true);

      // 如果已有错误，开始替换动画
      if (currentErrorRef.current) {
        setCurrentError(newError);
        setIsReplacing(true);

        // 动画完成后恢复正常
        setTimeout(() => {
          setIsReplacing(false);
        }, 200);
      } else {
        // 第一次显示错误
        setCurrentError(newError);
      }
    };

    // 监听错误事件
    window.addEventListener('globalError', handleError as EventListener);

    return () => {
      clearCloseTimer();
      clearExitTimer();
      window.removeEventListener('globalError', handleError as EventListener);
    };
  }, [clearCloseTimer, clearExitTimer]);

  useEffect(() => {
    if (!currentError || isClosing) {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearCloseTimer();
    };
  }, [currentError, handleClose, isClosing, clearCloseTimer]);

  if (!isVisible || !currentError) {
    return null;
  }

  return (
    <div
      className='tm-toast'
      data-type='error'
      data-visible={!isClosing}
      data-replacing={isReplacing || undefined}
    >
      <div className='tm-toast-icon'>
        <XCircle size={20} aria-hidden />
      </div>
      <div className='tm-toast-message' role='alert'>
        {currentError.message}
      </div>
      <button
        type='button'
        onClick={handleClose}
        className='tm-feedback-close'
        aria-label='关闭错误提示'
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}

// 全局错误触发函数
export function triggerGlobalError(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('globalError', {
        detail: { message },
      })
    );
  }
}
