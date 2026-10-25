'use client';

import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import Toast from '@/components/feedback/Toast';

// 取代浏览器自带的 alert / confirm：
//   notify('删除失败')                 → 本站样式的提示条
//   await askConfirm({ message })      → 本站样式的确认弹窗，返回 true / false
// 需要在根布局里放一个 <AppDialogHost />。

type NotifyType = 'success' | 'error' | 'info';

interface ConfirmRequest {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (value: boolean) => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: NotifyType;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let toastItem: ToastItem | null = null;
let confirmQueue: PendingConfirm[] = [];
let toastSeq = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

export function notify(message: string, type: NotifyType = 'info') {
  toastSeq += 1;
  toastItem = { id: toastSeq, message, type };
  emit();
}

export function notifyError(message: string) {
  notify(message, 'error');
}

export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  // 没有挂载宿主（比如服务端渲染）时保守地视为取消，不执行危险操作
  if (typeof window === 'undefined' || listeners.size === 0)
    return Promise.resolve(false);
  return new Promise((resolve) => {
    confirmQueue = [...confirmQueue, { ...request, resolve }];
    emit();
  });
}

export function AppDialogHost() {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const current = confirmQueue[0];
  const settle = (value: boolean) => {
    if (!current) return;
    confirmQueue = confirmQueue.slice(1);
    current.resolve(value);
    emit();
  };

  return (
    <>
      {toastItem ? (
        <Toast
          key={toastItem.id}
          message={toastItem.message}
          type={toastItem.type}
          onClose={() => {
            toastItem = null;
            emit();
          }}
        />
      ) : null}
      <ConfirmDialog
        isOpen={!!current}
        title={current?.title ?? '请确认'}
        message={current?.message ?? ''}
        confirmText={current?.confirmText}
        cancelText={current?.cancelText}
        variant={current?.variant ?? 'warning'}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </>
  );
}
