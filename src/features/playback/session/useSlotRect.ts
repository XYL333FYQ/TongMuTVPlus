'use client';

/*
 * 房间舞台占位框：播放器（全站唯一的那个）按它的位置和大小显示在房间页里。
 * 尺寸变了重新量；滚动时每帧把位置直接写进样式变量，不走 React 状态，停下后再同步一次。
 */

import { type RefObject, useEffect, useState } from 'react';

export function useSlotRect(
  slot: HTMLElement | null,
  hostRef: RefObject<HTMLDivElement | null>
) {
  const [slotRect, setSlotRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!slot) {
      setSlotRect(null);
      return;
    }
    const measure = () => setSlotRect(slot.getBoundingClientRect());
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    // Notices above the stage move the slot without changing its own size.
    const roomContainer = slot.closest('.tm-rooms');
    if (roomContainer) observer.observe(roomContainer);

    // 滚动时：每帧直接把占位框的位置写到样式变量上，不走 React 状态（否则整页每次滚动都重渲），
    // 并临时关掉位置过渡，窗口才会紧贴页面；停下后再同步一次状态。
    // 用户在显示设置里打开“缓动跟随”时保留过渡。
    const mount = () =>
      hostRef.current?.querySelector<HTMLElement>('[data-tm-player-mount]') ||
      null;
    let frame = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const follow = () => {
      frame = 0;
      const rect = slot.getBoundingClientRect();
      const style = hostRef.current?.style;
      if (!style) return;
      style.setProperty('--tm-slot-left', `${rect.left}px`);
      style.setProperty('--tm-slot-top', `${rect.top}px`);
      style.setProperty('--tm-slot-width', `${rect.width}px`);
      style.setProperty('--tm-slot-height', `${rect.height}px`);
    };
    const onScroll = () => {
      if (document.documentElement.dataset.tmPlayerEase !== 'true') {
        const element = mount();
        if (element) element.style.transition = 'none';
      }
      if (!frame) frame = requestAnimationFrame(follow);
      clearTimeout(idle);
      idle = setTimeout(() => {
        const element = mount();
        if (element) element.style.transition = '';
        measure();
      }, 160);
    };
    // Element scroll events do not bubble; capture BODY and nested page scrolling too.
    window.addEventListener('scroll', onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(idle);
      const element = mount();
      if (element) element.style.transition = '';
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', measure);
    };
  }, [slot, hostRef]);
  return slotRect;
}
