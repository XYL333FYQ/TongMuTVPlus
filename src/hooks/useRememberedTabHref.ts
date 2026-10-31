'use client';

import { useSyncExternalStore } from 'react';

import {
  rememberedTabHref,
  subscribeTabMemory,
  tabMemoryRevision,
} from '@/lib/tab-memory';

const serverRevision = () => 0;
export function useRememberedTabHref() {
  useSyncExternalStore(subscribeTabMemory, tabMemoryRevision, serverRevision);
  return rememberedTabHref;
}
