'use client';

import { type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/modal-layer.css';

import type { BackResult } from '@/lib/back-layers';
import { lockScroll } from '@/lib/scroll-lock';
import { useBackLayer } from '@/hooks/useBackLayer';

/**
 * 六种款式（设计稿 docs/design/prototypes/modal-layer.html、popup-per-device.html）：
 * dialog 居中（默认；只用于一句话的提醒，例如复制链接、HTTP 警告）；
 * panel 普通弹窗：手机从底部拉起、平板从右侧滑出、电脑居中；
 * sheet 菜单类面板（手机从底部拉起，平板电脑居中）；drawer 侧边抽屉（手机从底部拉起）；
 * confirm 确认框；viewer 整屏查看。
 */
export type ModalVariant =
  | 'dialog'
  | 'panel'
  | 'sheet'
  | 'drawer'
  | 'confirm'
  | 'viewer';

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
 * 点遮罩关闭：只有在遮罩上按下、又在遮罩上松开才关。在面板里按下拖到外面松手（选文字、拖滑块）
 * 不会误关；长按打开的菜单，那次长按松手落在遮罩上，也不会把刚打开的菜单关掉。
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
  initialFocus,
  returnFocusRef,
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
  /** 打开后先聚焦它（例如确认框的“取消”），不给就交给浏览器 */
  initialFocus?: RefObject<HTMLElement>;
  /** 关掉后焦点回到它（例如触屏点开详情时海报卡没拿到焦点）；不给就回到打开时有焦点的元素 */
  returnFocusRef?: RefObject<HTMLElement>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const focusRef = useRef(initialFocus);
  focusRef.current = initialFocus;
  const returnRef = useRef(returnFocusRef);
  returnRef.current = returnFocusRef;
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
      returnRef.current?.current ||
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
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
        // React 的事件沿组件树冒泡（门户也一样）：弹窗里再开的弹窗按 Esc 只关自己
        event.stopPropagation();
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
        if (!pressedBackdrop.current) return;
        pressedBackdrop.current = false;
        onClose();
      }}
    >
      {children}
    </dialog>,
    host
  );
}
