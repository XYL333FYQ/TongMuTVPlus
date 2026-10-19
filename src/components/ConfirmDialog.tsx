'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/feedback.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
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
            onClick={onConfirm}
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
