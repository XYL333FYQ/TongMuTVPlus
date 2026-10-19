'use client';

import type { Variants } from 'framer-motion';
import { type PointerEvent, useSyncExternalStore } from 'react';

// Pass useReducedMotionSetting() as the motion component's `custom` prop.
export const fadeUp: Variants = {
  hidden: (reducedMotion = false) => ({
    opacity: 0,
    y: reducedMotion ? 0 : 16,
  }),
  visible: (reducedMotion = false) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: reducedMotion ? 0.12 : 0.36,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export const stagger: Variants = {
  hidden: {},
  visible: (reducedMotion = false) => ({
    transition: { staggerChildren: reducedMotion ? 0 : 0.04 },
  }),
};

export function isReducedMotionSetting(): boolean {
  return (
    typeof window === 'undefined' ||
    document.documentElement.dataset.tmReducedMotion === 'true' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function subscribeToReducedMotion(update: () => void): () => void {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-tm-reduced-motion'],
  });
  media.addEventListener('change', update);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', update);
  };
}

const serverReducedMotion = () => true;

export function useReducedMotionSetting(): boolean {
  // SSR/hydration stay still; subsequently mounted cards use the actual first-frame preference.
  return useSyncExternalStore(
    subscribeToReducedMotion,
    isReducedMotionSetting,
    serverReducedMotion
  );
}

/**
 * 海报 3D 倾斜：跟随鼠标写入 --tm-poster-rx/ry 与高光位置 --mx/--my。
 * 触屏、减少动态时不启用。样式见 home.css 的 .tm-video-card。
 */
export const posterTiltHandlers = {
  onPointerMove(event: PointerEvent<HTMLElement>) {
    if (
      event.pointerType !== 'mouse' ||
      isReducedMotionSetting() ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    const style = event.currentTarget.style;
    style.setProperty('--tm-poster-rx', (0.5 - y) * 12 + 'deg');
    style.setProperty('--tm-poster-ry', (x - 0.5) * 12 + 'deg');
    style.setProperty('--mx', x * 100 + '%');
    style.setProperty('--my', y * 100 + '%');
  },
  onPointerLeave(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty('--tm-poster-rx', '0deg');
    event.currentTarget.style.setProperty('--tm-poster-ry', '0deg');
  },
};
