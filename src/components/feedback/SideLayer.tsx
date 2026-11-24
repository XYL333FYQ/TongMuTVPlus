'use client';

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import '@/styles/modal-layer.css';

import { cn } from '@/lib/cn';
import { useBackLayer } from '@/hooks/useBackLayer';

/**
 * 不挡页面的右侧面板（播放页的详情侧栏、AI 助手抽屉、纠错抽屉）：页面和播放器照常能点，
 * 所以不进模态的弹窗层，但挂法和关法只有这一份——
 * - 挂到 body（不会被带 transform 的祖先困住），是一个非模态 <dialog>；
 * - Esc / 返回键只在它是最上面一层、上面没有模态弹窗时关它；
 * - 卸载时把焦点还给打开前的元素。
 * 面板本身的样子和进出动画由使用方的子元素决定（只有子元素接收点按）。
 *
 * open=false 时仍挂着（让使用方做滑出动画），但不再响应 Esc / 返回键。
 *
 * semantics：dialog（非模态对话框，详情侧栏）或 region（页面旁边的一块区域，AI 助手、纠错抽屉）。
 */
export default function SideLayer({
  open = true,
  label,
  labelledBy,
  onClose,
  className,
  initialFocus,
  semantics = 'dialog',
  children,
}: {
  open?: boolean;
  label?: string;
  labelledBy?: string;
  onClose: () => void;
  className?: string;
  /** 打开后先聚焦哪个元素（一般是关闭按钮） */
  initialFocus?: RefObject<HTMLElement>;
  semantics?: 'dialog' | 'region';
  children: ReactNode;
}) {
  const layer = useRef<HTMLElement>(null);
  const callback = useRef(onClose);
  callback.current = onClose;
  const focusTarget = useRef(initialFocus);
  focusTarget.current = initialFocus;
  const active = useRef(open);
  active.current = open;
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  useBackLayer(open, () => callback.current());

  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    if (element instanceof HTMLDialogElement) {
      if (typeof element.show === 'function') element.show();
      else element.setAttribute('open', '');
    }
    const keys = (event: KeyboardEvent) => {
      if (!active.current) return;
      if (event.defaultPrevented || event.key !== 'Escape') return;
      // 上面有模态弹窗、或者还有更靠上的侧栏时，Esc 归它们
      if (document.querySelector('dialog[open][aria-modal="true"]')) return;
      if (
        Array.from(
          document.querySelectorAll('.tm-side-layer[data-active="true"]')
        ).pop() !== element
      )
        return;
      event.preventDefault();
      callback.current();
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      if (element instanceof HTMLDialogElement) {
        if (typeof element.close === 'function') element.close();
        else element.removeAttribute('open');
      }
    };
  }, [host]);

  // 焦点：每次打开时记下是谁打开的、移到面板里；收起或卸载时，焦点还在面板里（或已经掉到 body）才还回去。
  // 一直挂着的抽屉（AI 助手）不会在离开页面时把焦点抢回页面刚打开时的元素。
  useEffect(() => {
    if (!open || !host) return;
    const element = layer.current;
    const trigger =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    focusTarget.current?.current?.focus({ preventScroll: true });
    return () => {
      const current = document.activeElement;
      const lost =
        !current || current === document.body || !!element?.contains(current);
      if (lost && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, host]);

  if (!host) return null;
  const props = {
    className: cn('tm-side-layer', className),
    'aria-label': labelledBy ? undefined : label,
    'aria-labelledby': labelledBy,
    'data-active': open ? 'true' : 'false',
  };
  return createPortal(
    semantics === 'dialog' ? (
      <dialog
        ref={layer as RefObject<HTMLDialogElement>}
        role='dialog'
        aria-modal={false}
        {...props}
      >
        {children}
      </dialog>
    ) : (
      <aside ref={layer} {...props}>
        {children}
      </aside>
    ),
    host
  );
}
