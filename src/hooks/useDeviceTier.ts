'use client';

import { useSyncExternalStore } from 'react';

import {
  type DeviceTier,
  getDeviceTier,
  onDeviceTierChange,
} from '@/lib/device-tier';

/** 当前设备档位（见 lib/device-tier.ts）；服务端渲染和首次注水按电脑处理 */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(
    onDeviceTierChange,
    getDeviceTier,
    () => 'wide' as DeviceTier
  );
}
