'use client';

import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/modal-layer.css';

import type { BackResult } from '@/lib/back-layers';
import { lockScroll } from '@/lib/scroll-lock';
import { useBackLayer } from '@/hooks/useBackLayer';

/**
 * 五种款式（设计稿 docs/design/prototypes/modal-layer.html）：
 * dialog 居中面板（默认，样子和以前一样）；sheet 底部面板；drawer 侧边抽屉（手机从底部拉起）；
 * confirm 确认框；viewer 整屏查看。
 */
export type ModalVariant = 'dialog' | 'sheet' | 'drawer' | 'confirm' | 'viewer';

const FOCUSABLE = [
  'button:not(:disabled):not([hidden])',
  '[href]',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * 原生模态层：焦点关在弹窗里、盖住全站，返回键 / Esc / 点遮罩关闭，打开期间锁住页面滚动，
 * 关掉后焦点回到打开它的按钮。弹窗里面的内容和按钮由各功能自己放。
 *
 * 弹窗挂在 body 下：放在卡片、房间页里打开时，不继承它们的文字样式、不触发它们的悬停效果。
 *
 * onClose 返回 'blocked' 表示现在不能关（例如确认中），返回键也会被吃掉、不离开页面。
 * closeOnBackdrop='press'：只有在遮罩上按下、又在遮罩上松开才关。长按打开的菜单要用它，
 * 打开菜单的那次长按松手会落在遮罩上，不能把刚打开的菜单关掉。
 */
const subscribeNothing = () => () => undefined;
const onClientSnapshot = () => true;
const onServerSnapshot = () => false;

export default function ModalLayer({
  label,
  onClose,
  children,
  className = '',
  variant = 'dialog',
  role,
  describedBy,
  closeOnBackdrop = 'click',
  initialFocus,
}: {
  label: string;
  onClose: () => BackResult | void;
  children: React.ReactNode;
  className?: string;
  variant?: ModalVariant;
  /** 需要用户确认的弹窗用 alertdialog */
  role?: 'dialog' | 'alertdialog';
  /** 说明文字的 id，读屏软件打开时读出 */
  describedBy?: string;
  closeOnBackdrop?: 'click' | 'press';
  /** 打开后先聚焦它（例如确认框的“取消”），不给就交给浏览器 */
  initialFocus?: RefObject<HTMLElement>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const focusRef = useRef(initialFocus);
  focusRef.current = initialFocus;
  // 服务端和水合时没有 body，先不渲染；其余时候第一次渲染就挂上，
  // 调用方同一次提交里的 effect 就能拿到弹窗里的元素
  const onClient = useSyncExternalStore(
    subscribeNothing,
    onClientSnapshot,
    onServerSnapshot
  );
  const host = onClient ? document.body : null;
  useBackLayer(true, onClose);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!host || !dialog) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // 旧浏览器（iOS 15.4 以前）没有 showModal：退回普通打开，其余行为照旧
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    focusRef.current?.current?.focus({ preventScroll: true });
    const unlock = lockScroll();
    return () => {
      unlock();
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      if (trigger?.isConnected && document.activeElement !== trigger)
        trigger.focus({ preventScroll: true });
    };
  }, [host]);
  if (!host) return null;
  const variantClass =
    variant === 'dialog' ? '' : ` tm-modal-layer--${variant}`;
  return createPortal(
    <dialog
      ref={dialogRef}
      role={role}
      aria-label={label}
      aria-describedby={describedBy}
      aria-modal='true'
      className={`tm-modal-layer${variantClass} ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        // Esc 归最上面这一层，页面上监听 Esc 的地方（播放器、菜单）收不到
        if (event.key === 'Escape') event.stopPropagation();
        if (event.key !== 'Tab' || event.defaultPrevented) return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (closeOnBackdrop === 'press' && !pressedBackdrop.current) return;
        pressedBackdrop.current = false;
        onClose();
      }}
    >
      {children}
    </dialog>,
    host
  );
}
