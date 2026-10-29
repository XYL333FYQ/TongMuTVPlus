'use client';

import { CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const [host, setHost] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const dialogs =
      document.querySelectorAll<HTMLDialogElement>('dialog[open]');
    return (
      document.activeElement?.closest<HTMLDialogElement>('dialog[open]') ||
      dialogs[dialogs.length - 1] ||
      document.body
    );
  });
  const callback = useRef(onClose);
  callback.current = onClose;
  const dismiss = useRef<() => void>(() => undefined);

  useEffect(() => {
    // Keep the portal connected as modals open, close or unmount. Opening order
    // and actual focus take precedence over a dialog's position in the DOM.
    let order = Array.from(
      document.querySelectorAll<HTMLDialogElement>('dialog[open]')
    );
    const refresh = (records: MutationRecord[] = []) => {
      for (const record of records) {
        if (
          record.type === 'attributes' &&
          record.target instanceof HTMLDialogElement
        ) {
          const dialog = record.target;
          order = order.filter((item) => item !== dialog);
          if (dialog.open && dialog.isConnected) order.push(dialog);
        }
      }
      const opened = Array.from(
        document.querySelectorAll<HTMLDialogElement>('dialog[open]')
      );
      order = order.filter((dialog) => opened.includes(dialog));
      for (const dialog of opened) {
        if (!order.includes(dialog)) order.push(dialog);
      }
      const focused =
        document.activeElement?.closest<HTMLDialogElement>('dialog[open]');
      if (focused)
        order = [...order.filter((dialog) => dialog !== focused), focused];
      setHost(order[order.length - 1] || document.body);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    const focused = () => refresh();
    document.addEventListener('focusin', focused);
    refresh();
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', focused);
    };
  }, []);

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

  if (!host) return null;

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
    host
  );
}
