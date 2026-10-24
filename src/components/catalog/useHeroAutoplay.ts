'use client';

import { useMotionValue } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';

const IDLE_DELAY = 12000;

/** One clock drives the cover change and its visual countdown for both homepages. */
export function useHeroAutoplay({
  index,
  count,
  onAdvance,
  interval,
  disabled,
}: {
  index: number;
  count: number;
  onAdvance: (index: number) => void;
  interval: number;
  disabled: boolean;
}) {
  const reduced = useReducedMotionSetting();
  const progress = useMotionValue(0);
  const [visible, setVisible] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const idleUntil = useRef(0);
  const advance = useRef(onAdvance);
  advance.current = onAdvance;
  const duration = Number.isFinite(interval) && interval > 0 ? interval : 8000;
  const enabled = count > 1 && !disabled && !reduced && visible;

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const interact = useCallback(() => {
    idleUntil.current = Date.now() + IDLE_DELAY;
    setWaiting(true);
  }, []);
  const extendIdle = useCallback(() => {
    if (waiting) idleUntil.current = Date.now() + IDLE_DELAY;
  }, [waiting]);

  useEffect(() => {
    progress.set(0);
    if (!enabled) return;
    let timer = 0;
    let frame = 0;
    if (waiting) {
      const resumeWhenIdle = () => {
        const remaining = idleUntil.current - Date.now();
        if (remaining > 0) timer = window.setTimeout(resumeWhenIdle, remaining);
        else setWaiting(false);
      };
      resumeWhenIdle();
    } else {
      const started = Date.now();
      const tick = () => {
        progress.set(Math.min(1, (Date.now() - started) / duration));
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      timer = window.setTimeout(() => {
        progress.set(0);
        advance.current((index + 1) % count);
      }, duration);
    }
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [index, count, enabled, waiting, duration, progress]);

  return {
    progress,
    interact,
    extendIdle,
    state: !enabled ? 'suspended' : waiting ? 'idle' : 'running',
  };
}
