'use client';

import { useSyncExternalStore } from 'react';

import {
  type DeviceTier,
  type PageLayout,
  getDeviceTier,
  isCoarsePointer,
  onDeviceTierChange,
  pageLayoutFor,
} from '@/lib/device-tier';

/** 当前设备档位（见 lib/device-tier.ts）；服务端渲染和首次注水按电脑处理 */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(
    onDeviceTierChange,
    getDeviceTier,
    () => 'wide' as DeviceTier
  );
}

function onPointerChange(listener: () => void) {
  const query = window.matchMedia?.('(pointer: coarse)');
  query?.addEventListener?.('change', listener);
  return () => query?.removeEventListener?.('change', listener);
}

/** 页面排版：compact / tablet / desktop（见 lib/device-tier.ts 的 pageLayoutFor） */
export function usePageLayout(): PageLayout {
  const tier = useDeviceTier();
  const coarse = useSyncExternalStore(
    onPointerChange,
    isCoarsePointer,
    () => false
  );
  return pageLayoutFor(tier, coarse);
}
