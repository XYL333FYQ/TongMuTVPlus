'use client';

import { useEffect } from 'react';

/** One registration owns both push and caching; updates never reload the page. */
export default function PwaRegistration({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Optional progressive enhancement: browsing must survive registration
        // failure. Explicit notification setup reports its own actionable error.
      });
  }, [enabled]);
  return null;
}
