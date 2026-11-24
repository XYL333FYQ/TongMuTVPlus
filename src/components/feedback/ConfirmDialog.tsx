'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { logger } from '@/lib/logger';

import ModalLayer from '@/components/feedback/ModalLayer';

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

/** 确认框：弹窗层的 confirm 款式（最宽 400，两个按钮等宽，确认在右） */
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
  const cancel = useRef<HTMLButtonElement>(null);
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
    if (!isOpen) return;
    pendingRef.current = false;
    setPending(false);
  }, [isOpen]);

  const dismiss = () => {
    // 确认中（按钮转圈时）Esc、返回键、点外面都不关
    if (pendingRef.current) return 'blocked' as const;
    onCancel();
    return 'handled' as const;
  };

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
        logger.error('确认操作失败:', error);
      })
      .finally(() => {
        pendingRef.current = false;
        if (mounted.current) setPending(false);
      });
  };

  if (!isOpen) return null;

  return (
    <ModalLayer
      variant='confirm'
      role='alertdialog'
      label={title}
      describedBy={messageId}
      onClose={dismiss}
      // 打开时焦点在“取消”上：删除这类不可撤销的操作不会被回车误确认
      initialFocus={cancel}
    >
      <div className='tm-confirm-panel' data-variant={variant}>
        <div className='tm-confirm-header'>
          <div className='tm-confirm-heading'>
            <AlertTriangle size={24} aria-hidden='true' />
            <h2>{title}</h2>
          </div>
          <button
            type='button'
            aria-label='关闭确认'
            onClick={dismiss}
            disabled={pending}
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
            onClick={dismiss}
            disabled={pending}
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
    </ModalLayer>
  );
}
