'use client';

import { useEffect, useRef } from 'react';

import {
  type PageRefreshHandler,
  registerPageRefresh,
} from '@/lib/page-refresh';
import { getPlatform } from '@/lib/platform';

/** Only installed clients opt in; ordinary web keeps its existing lifecycle. */
export function usePageRefresh(
  path: string,
  handler: PageRefreshHandler,
  enabled = true,
  identity = path
) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!enabled || getPlatform() !== 'app') return;
    return registerPageRefresh(path, (signal) => latest.current(signal));
  }, [enabled, path, identity]);
}
