'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  // 可以返回 Promise：等待期间按钮禁用，防止连点重复执行不可撤销操作
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const cancelCallback = useRef(onCancel);
  cancelCallback.current = onCancel;
  const titleId = useId();
  const messageId = useId();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 每次重新打开都允许再次确认
  useEffect(() => {
    if (isOpen) {
      pendingRef.current = false;
      setPending(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (pendingRef.current) return;
    const result = onConfirm();
    // 同步操作直接结束；只有返回 Promise 时才进入等待态
    if (!result || typeof result.then !== 'function') return;
    pendingRef.current = true;
    setPending(true);
    result
      .catch((error) => {
        // 失败时保留弹窗并恢复按钮，具体提示由调用方负责
        console.error('确认操作失败:', error);
      })
      .finally(() => {
        pendingRef.current = false;
        if (mounted.current) setPending(false);
      });
  };

  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const nativeModal = typeof element.showModal === 'function';
    if (nativeModal) element.showModal();
    else element.setAttribute('open', '');
    // Deleting downloads is irreversible: opening a confirmation never selects Delete.
    cancel.current?.focus({ preventScroll: true });
    const dismiss = (event: Event) => {
      event.preventDefault();
      cancelCallback.current();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!nativeModal && event.key === 'Escape') dismiss(event);
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
        element.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      );
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    element.addEventListener('cancel', dismiss);
    element.addEventListener('keydown', keys);
    return () => {
      element.removeEventListener('cancel', dismiss);
      element.removeEventListener('keydown', keys);
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialog}
      className='tm-confirm-dialog'
      role='alertdialog'
      aria-modal='true'
      aria-labelledby={titleId}
      aria-describedby={messageId}
      data-variant={variant}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className='tm-confirm-panel'>
        <div className='tm-confirm-header'>
          <div className='tm-confirm-heading'>
            <AlertTriangle size={24} aria-hidden='true' />
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type='button'
            aria-label='关闭确认'
            onClick={onCancel}
            className='tm-feedback-close tm-press'
          >
            <X size={20} aria-hidden='true' />
          </button>
        </div>

        <div className='tm-confirm-content'>
          <p id={messageId}>{message}</p>
        </div>

        <div className='tm-confirm-footer'>
          <button
            ref={cancel}
            type='button'
            onClick={onCancel}
            className='tm-confirm-cancel tm-press'
          >
            {cancelText}
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
            className='tm-confirm-action tm-press'
          >
            {confirmText}
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
