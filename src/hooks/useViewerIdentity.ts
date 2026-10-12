'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

/** UI routing only. Protected APIs still verify the cookie on the server. */
export function useViewerIdentity() {
  const pathname = usePathname();
  const [identity, setIdentity] = useState({
    ready: false,
    isGuest: true,
    loginHref: '/login',
  });

  useEffect(() => {
    const update = () => {
      const auth = getAuthInfoFromBrowserCookie();
      setIdentity({
        ready: true,
        isGuest: !auth?.username && !auth?.password && !auth?.signature,
        loginHref:
          '/login?redirect=' +
          encodeURIComponent(window.location.pathname + window.location.search),
      });
    };
    update();
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
    };
  }, [pathname]);

  return {
    ...identity,
    loginHref:
      identity.ready && typeof window !== 'undefined'
        ? '/login?redirect=' +
          encodeURIComponent(window.location.pathname + window.location.search)
        : identity.loginHref,
  };
}
