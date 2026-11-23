'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  type SettingKey,
  readSetting,
  removeSetting,
  subscribeSetting,
  writeSetting,
} from '@/lib/settings';

/**
 * 读写一个本地设置，并跟着同页其他组件和别的标签页的修改重新渲染。
 * 服务端渲染时是 null；传 null 表示删掉这个键。
 */
export function useSetting(
  key: SettingKey
): [string | null, (value: string | null) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeSetting(key, onChange),
    [key]
  );
  const value = useSyncExternalStore(
    subscribe,
    () => readSetting(key),
    () => null
  );
  const setValue = useCallback(
    (next: string | null) => {
      if (next === null) removeSetting(key);
      else writeSetting(key, next);
    },
    [key]
  );
  return [value, setValue];
}
