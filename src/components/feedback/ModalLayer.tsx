'use client';

import { useEffect, useRef } from 'react';

import '@/styles/modal-layer.css';

import { useBackLayer } from '@/hooks/useBackLayer';

/** 原生模态层提供焦点约束与平台关闭请求，保留各功能自己的操作。 */
export default function ModalLayer({
  label,
  onClose,
  children,
  className = '',
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useBackLayer(true, onClose);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className={`tm-modal-layer ${className}`}
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
