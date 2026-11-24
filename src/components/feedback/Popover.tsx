'use client';

import { type ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/modal-layer.css';

import { cn } from '@/lib/cn';

import {
  type AnchoredLayerOptions,
  type DismissReason,
  useAnchoredLayer,
} from './useAnchoredLayer';

/**
 * 贴着按钮弹出的浮层：筛选面板、账号菜单、原集名提示。位置、挂在哪、怎么关都归 useAnchoredLayer；
 * 里面放什么、长什么样由调用方的类名决定。渲染它就是打开，不渲染就是关上。
 *
 * 挂进打开的弹窗时是“客人”（data-tm-layer-guest），弹窗层的款式规则不把它当面板。
 */
export default function Popover({
  anchor,
  onDismiss,
  children,
  className,
  id,
  role,
  label,
  interactive = true,
  ...placement
}: Omit<AnchoredLayerOptions, 'open' | 'panelRef' | 'onDismiss'> & {
  onDismiss: (reason: DismissReason) => void;
  children: ReactNode;
  className?: string;
  id?: string;
  role?: 'dialog' | 'menu' | 'tooltip' | 'listbox' | 'group';
  label?: string;
  /** 只是提示、不接收点按（点按穿过去） */
  interactive?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { host, style, up } = useAnchoredLayer({
    open: true,
    anchor,
    panelRef,
    onDismiss,
    ...placement,
  });
  if (!host) return null;
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={label}
      className={cn('tm-popover-layer', className)}
      data-tm-layer-guest=''
      data-up={up ? '' : undefined}
      data-passive={interactive ? undefined : ''}
      style={style}
    >
      {children}
    </div>,
    host
  );
}
