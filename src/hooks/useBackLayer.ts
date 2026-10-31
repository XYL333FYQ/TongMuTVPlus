'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

import { type BackResult, registerBackLayer } from '@/lib/back-layers';

const useClientLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Keep registration order stable while the close callback/state changes. */
export function useBackLayer(open: boolean, onBack: () => BackResult | void) {
  const handler = useRef(onBack);
  handler.current = onBack;
  useClientLayoutEffect(() => {
    if (!open) return;
    return registerBackLayer(() => handler.current() || 'handled');
  }, [open]);
}
