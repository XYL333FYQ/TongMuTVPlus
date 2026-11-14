'use client';

import { CSSProperties, RefObject, useEffect, useState } from 'react';

// 小窗拖动：只给小窗的画面和底栏加一个位移（CSS 变量 → transform），
// 不改它们的定位、尺寸，也不碰视频元素本身，拖动时不会断播。
// 松手后吸附到最近的角落，位置记在本地，下次打开小窗还在原处。

export const MINI_PLAYER_OFFSET_KEY = 'tongmu:mini-player-offset';
const DRAG_THRESHOLD = 6; // 移动不到这么多像素仍算点击
const HEADER_CLEARANCE = 72; // 不盖住顶部导航

export interface Offset {
  x: number;
  y: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function readStoredOffset(): Offset {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(MINI_PLAYER_OFFSET_KEY) || 'null'
    );
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y))
      return { x: parsed.x, y: parsed.y };
  } catch {
    // 存储不可用或内容损坏时回到默认位置
  }
  return { x: 0, y: 0 };
}

function storeOffset(offset: Offset) {
  try {
    window.localStorage.setItem(MINI_PLAYER_OFFSET_KEY, JSON.stringify(offset));
  } catch {
    // 隐私模式等情况下存不了，不影响本次拖动
  }
}

function miniParts(host: HTMLElement) {
  return Array.from(
    host.querySelectorAll<HTMLElement>(
      '[data-tm-player-mount], .tm-playback-chrome'
    )
  );
}

// 完整画面缩成小窗时有 400ms 的形态过渡；过渡没结束时量到的还是大画面，
// 不能拿来算位置。浏览器在后台标签页里还会推迟过渡，所以按实际动画状态判断
function runningAnimations(host: HTMLElement): Animation[] {
  return miniParts(host).flatMap((element) =>
    typeof element.getAnimations === 'function'
      ? element.getAnimations().filter((a) => a.playState === 'running')
      : []
  );
}

// 画面 + 底栏合起来的外框（包含当前位移）
function measure(host: HTMLElement): Box | null {
  const parts = miniParts(host)
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!parts.length) return null;
  return {
    left: Math.min(...parts.map((rect) => rect.left)),
    top: Math.min(...parts.map((rect) => rect.top)),
    right: Math.max(...parts.map((rect) => rect.right)),
    bottom: Math.max(...parts.map((rect) => rect.bottom)),
  };
}

function shift(box: Box, dx: number, dy: number): Box {
  return {
    left: box.left + dx,
    top: box.top + dy,
    right: box.right + dx,
    bottom: box.bottom + dy,
  };
}

// base 是不加位移时（默认位置）的外框。默认位置就是设计的最低点：
// 手机上它已经让开了底部导航，所以不允许拖得比它更低
function limits(base: Box) {
  const margin = window.innerWidth < 768 ? 12 : 24;
  const width = base.right - base.left;
  const minLeft = margin;
  const maxLeft = Math.max(minLeft, window.innerWidth - margin - width);
  const maxTop = base.top;
  const minTop = Math.min(HEADER_CLEARANCE, maxTop);
  return { minLeft, maxLeft, minTop, maxTop };
}

export function clampOffset(base: Box, offset: Offset): Offset {
  const { minLeft, maxLeft, minTop, maxTop } = limits(base);
  const left = Math.min(maxLeft, Math.max(minLeft, base.left + offset.x));
  const top = Math.min(maxTop, Math.max(minTop, base.top + offset.y));
  return { x: left - base.left, y: top - base.top };
}

// 吸附到最近的角落：左右、上下各取离得近的一边
export function snapOffset(base: Box, offset: Offset): Offset {
  const { minLeft, maxLeft, minTop, maxTop } = limits(base);
  const { left: nowLeft, top: nowTop } = shift(base, offset.x, offset.y);
  const left =
    Math.abs(nowLeft - minLeft) <= Math.abs(nowLeft - maxLeft)
      ? minLeft
      : maxLeft;
  const top =
    Math.abs(nowTop - minTop) <= Math.abs(nowTop - maxTop) ? minTop : maxTop;
  return { x: left - base.left, y: top - base.top };
}

export function useMiniPlayerDrag(
  hostRef: RefObject<HTMLElement>,
  enabled: boolean
): { style: CSSProperties; dragging: boolean } {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // 只在浏览器里读取，避免服务端渲染与首屏不一致
  useEffect(() => {
    setOffset(readStoredOffset());
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!enabled || !host) return;

    let current = readStoredOffset();
    let start: { x: number; y: number; offset: Offset; base: Box } | null =
      null;
    let moved = false;

    // 窗口尺寸变了（转屏、缩放）时把小窗拉回可见范围
    const keepInView = () => {
      const box = measure(host);
      if (!box) return;
      const base = shift(box, -current.x, -current.y);
      const next = clampOffset(base, current);
      if (next.x !== current.x || next.y !== current.y) {
        current = next;
        setOffset(next);
        storeOffset(next);
      }
    };

    const suppressNextClick = () => {
      const swallow = (event: Event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      // 有的浏览器拖动后不会再派发 click，下一轮事件循环就撤掉
      window.setTimeout(
        () => window.removeEventListener('click', swallow, { capture: true }),
        0
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        setDragging(true);
      }
      event.preventDefault();
      current = clampOffset(start.base, {
        x: start.offset.x + dx,
        y: start.offset.y + dy,
      });
      setOffset(current);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      if (start && moved) {
        current = snapOffset(start.base, current);
        setOffset(current);
        storeOffset(current);
        setDragging(false);
        suppressNextClick();
      }
      start = null;
      moved = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-tm-player-mount], .tm-playback-chrome'))
        return;
      // 正在变形（刚从完整画面缩小）时不开始拖动，量到的尺寸还不对
      if (runningAnimations(host).length) return;
      const box = measure(host);
      if (!box) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        offset: current,
        base: shift(box, -current.x, -current.y),
      };
      moved = false;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    host.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', keepInView);
    // 小窗刚出现时校正一次：在大屏上存的位置放到小屏上可能出界。
    // 等形态过渡真正结束再量
    let disposed = false;
    const initialFit = window.setTimeout(() => {
      void Promise.allSettled(
        runningAnimations(host).map((animation) => animation.finished)
      ).then(() => {
        if (!disposed) keepInView();
      });
    }, 0);
    return () => {
      disposed = true;
      window.clearTimeout(initialFit);
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', keepInView);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      setDragging(false);
    };
  }, [enabled, hostRef]);

  return {
    style: {
      '--tm-mini-x': `${offset.x}px`,
      '--tm-mini-y': `${offset.y}px`,
    } as CSSProperties,
    dragging,
  };
}
