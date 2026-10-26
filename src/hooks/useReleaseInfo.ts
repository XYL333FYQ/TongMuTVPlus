'use client';

import { useEffect, useState } from 'react';

import { defaultReleaseInfo, parseReleaseInfo } from '@/lib/release-info';

export function useReleaseInfo(enabled = true) {
  const [info, setInfo] = useState(defaultReleaseInfo);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const response = await fetch('/api/server-config', {
          cache: 'no-store',
          signal: current.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        const next = parseReleaseInfo(data.ReleaseInfo);
        if (active && !current.signal.aborted) setInfo(next);
      } catch {
        // 离线或旧服务端没有发布字段时，保留最后有效值/内置记录。
      }
    };
    const onUpdated = () => {
      void refresh();
    };
    void refresh();
    window.addEventListener('tongmu:release-updated', onUpdated);
    window.addEventListener('focus', onUpdated);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('tongmu:release-updated', onUpdated);
      window.removeEventListener('focus', onUpdated);
    };
  }, [enabled]);
  return info;
}
