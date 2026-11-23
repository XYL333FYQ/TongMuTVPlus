'use client';

import { useEffect, useRef } from 'react';

import '@/styles/modal-layer.css';

import { lockScroll } from '@/lib/scroll-lock';
import { useBackLayer } from '@/hooks/useBackLayer';

/**
 * 五种款式（设计稿 docs/design/prototypes/modal-layer.html）：
 * dialog 居中面板（默认，样子和以前一样）；sheet 底部面板；drawer 侧边抽屉（手机从底部拉起）；
 * confirm 确认框；viewer 整屏查看。
 */
export type ModalVariant = 'dialog' | 'sheet' | 'drawer' | 'confirm' | 'viewer';

/**
 * 原生模态层：焦点关在弹窗里、盖住全站，返回键 / Esc / 点遮罩关闭，打开期间锁住页面滚动。
 * 弹窗里面的内容和按钮由各功能自己放。
 */
export default function ModalLayer({
  label,
  onClose,
  children,
  className = '',
  variant = 'dialog',
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: ModalVariant;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useBackLayer(true, onClose);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const unlock = lockScroll();
    return () => {
      unlock();
      dialog.close();
    };
  }, []);
  const variantClass =
    variant === 'dialog' ? '' : ` tm-modal-layer--${variant}`;
  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className={`tm-modal-layer${variantClass} ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
