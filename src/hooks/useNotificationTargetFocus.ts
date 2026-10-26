'use client';

import { useEffect, useRef } from 'react';

// 管理页同时渲染桌面和手机布局，只定位当前可见的那一份。
export function useNotificationTargetFocus<T extends HTMLElement>(
  targetId: string | null | undefined,
  ready: boolean,
  navigationKey?: string | null
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!targetId || !ready || !element || !element.getClientRects().length)
      return;
    element.scrollIntoView({ block: 'center', behavior: 'auto' });
    element.focus({ preventScroll: true });
  }, [targetId, ready, navigationKey]);
  return ref;
}
