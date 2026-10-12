'use client';

import type { Variants } from 'framer-motion';
import { useEffect, useState } from 'react';

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

export function useReducedMotionSetting(): boolean {
  // Until hydration establishes the preference, avoid starting movement.
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(isReducedMotionSetting());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-tm-reduced-motion'],
    });
    media.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);
  return reducedMotion;
}
