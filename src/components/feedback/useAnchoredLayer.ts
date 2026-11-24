'use client';

import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * 贴着按钮弹出的浮层（下拉选择、筛选、账号菜单、提示）的唯一定位规则（STANDARD.md 公共零件“弹窗层”）：
 * - 挂在按钮所在的打开的弹窗里（原生模态弹窗外面的东西点不到），没有就挂 body；
 * - 先量浮层自己的大小，再放到按钮下方（或上方），放不下就翻到另一边，左右不出屏；
 * - 页面滚动、窗口变化时跟着按钮走；在浮层和按钮以外按下、按 Esc 就关。
 *
 * 用法：Popover 组件；自己画列表的 Select 直接用这个钩子。
 */

export type AnchorAlign = 'start' | 'end' | 'center';
export type DismissReason = 'outside' | 'escape';

export interface AnchoredLayerOptions {
  open: boolean;
  anchor: HTMLElement | null;
  panelRef: RefObject<HTMLElement>;
  onDismiss: (reason: DismissReason) => void;
  /** 和按钮左边对齐（默认）、右边对齐、居中 */
  align?: AnchorAlign;
  /** 默认放在下方，空间不够再翻 */
  prefer?: 'below' | 'above';
  /** 宽度定死（会被屏幕宽度压缩）；不给就按内容宽度，夹在 minWidth 和 maxWidth 之间 */
  width?: number;
  /** 至少和按钮一样宽 */
  matchAnchorWidth?: boolean;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** 最高占屏幕高度的几成（例如 0.5） */
  maxHeightRatio?: number;
  /** 和按钮的距离 */
  gap?: number;
  /** 离屏幕边缘至少留多少 */
  edge?: number;
  /** 判断要不要翻到上方时用的高度；不给就量内容高度 */
  preferredHeight?: number;
  /** 自己处理 Esc 的（例如 Select 要把焦点还给按钮）传 false */
  closeOnEscape?: boolean;
}

interface Box {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight?: number;
  up: boolean;
}

// 浮层用 fixed 定位，能放的范围是布局视口（不含滚动条），不是设备档位
const viewportWidth = () => document.documentElement.clientWidth;
const viewportHeight = () => document.documentElement.clientHeight;

export function useAnchoredLayer({
  open,
  anchor,
  panelRef,
  onDismiss,
  align = 'start',
  prefer = 'below',
  width,
  matchAnchorWidth = false,
  minWidth = 0,
  maxWidth = 600,
  maxHeight,
  maxHeightRatio,
  gap = 6,
  edge = 8,
  preferredHeight,
  closeOnEscape = true,
}: AnchoredLayerOptions) {
  const [box, setBox] = useState<Box | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const anchorWidth = anchor?.getBoundingClientRect().width ?? 0;
  // 量不到视口（服务端、后台标签页）时不按屏幕宽度压缩
  const measuredWidth = typeof document === 'undefined' ? 0 : viewportWidth();
  const roomWidth = measuredWidth > 0 ? measuredWidth - edge * 2 : maxWidth;
  const widest = Math.max(0, Math.min(maxWidth, roomWidth));
  const narrowest = Math.min(
    widest,
    Math.max(minWidth, matchAnchorWidth ? anchorWidth : 0)
  );
  const fixedWidth =
    width === undefined
      ? undefined
      : Math.min(widest, Math.max(width, narrowest));

  const place = useCallback(() => {
    const panel = panelRef.current;
    if (!anchor || !panel || !anchor.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const vw = viewportWidth();
    const vh = viewportHeight();
    const panelWidth = panel.offsetWidth;
    const cap = Math.min(
      maxHeight ?? Infinity,
      maxHeightRatio ? vh * maxHeightRatio : Infinity
    );
    const natural = Math.min(preferredHeight ?? panel.scrollHeight, cap);
    const below = vh - rect.bottom - gap - edge;
    const above = rect.top - gap - edge;
    const up =
      prefer === 'above'
        ? !(above < natural && below > above)
        : below < natural && above > below;
    const room = Math.max(120, up ? above : below);
    const start =
      align === 'end'
        ? rect.right - panelWidth
        : align === 'center'
        ? rect.left + rect.width / 2 - panelWidth / 2
        : rect.left;
    const left = Math.min(
      Math.max(edge, start),
      Math.max(edge, vw - panelWidth - edge)
    );
    setBox({
      left,
      up,
      maxHeight: Math.min(cap, room),
      ...(up ? { bottom: vh - rect.top + gap } : { top: rect.bottom + gap }),
    });
  }, [
    anchor,
    panelRef,
    align,
    prefer,
    maxHeight,
    maxHeightRatio,
    gap,
    edge,
    preferredHeight,
  ]);

  useLayoutEffect(() => {
    if (open) place();
    else setBox(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // 浮层上面又开了弹窗（例如菜单里打开的“更多功能”）：那里的按键和按下归那个弹窗
    const hostDialog = anchor?.closest('dialog[open]') ?? null;
    const ownedAbove = (node: Node) => {
      const element = node instanceof Element ? node : node.parentElement;
      const dialog = element?.closest('dialog[open]') ?? null;
      return dialog !== null && dialog !== hostDialog;
    };
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (ownedAbove(node)) return;
      if (panelRef.current?.contains(node) || anchor?.contains(node)) return;
      dismissRef.current('outside');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (ownedAbove(event.target as Node)) return;
      // 先于弹窗收到：Esc 只关最上面这一层浮层，不连带关掉它所在的弹窗
      event.preventDefault();
      event.stopPropagation();
      dismissRef.current('escape');
    };
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    if (closeOnEscape) window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchor, panelRef, place, closeOnEscape]);

  const host =
    open && anchor
      ? anchor.closest('dialog[open]') ?? anchor.ownerDocument.body
      : null;

  const size: CSSProperties =
    fixedWidth === undefined
      ? { width: 'max-content', minWidth: narrowest, maxWidth: widest }
      : { width: fixedWidth };
  const style: CSSProperties = box
    ? {
        ...size,
        left: box.left,
        top: box.top,
        bottom: box.bottom,
        maxHeight: box.maxHeight,
      }
    : // 第一次先不显示，量好大小再放到位置上
      { ...size, left: 0, top: 0, visibility: 'hidden' };

  return {
    host,
    style,
    up: box?.up ?? false,
    placed: !!box,
    reposition: place,
  };
}
