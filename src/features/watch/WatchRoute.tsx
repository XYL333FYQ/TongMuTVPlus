'use client';

/*
 * /play 路由：把地址栏里的影片交给独立看会话，再显示新播放页。
 */

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { useWatchSession } from './session/context';
import WatchPage from './WatchPage';

function RouteBridge() {
  const params = useSearchParams();
  const { open } = useWatchSession();
  const query = params.toString();
  useEffect(() => {
    if (query) open(`/play?${query}`);
  }, [query, open]);
  return null;
}

export default function WatchRoute() {
  return (
    <>
      <Suspense fallback={null}>
        <RouteBridge />
      </Suspense>
      <WatchPage />
    </>
  );
}
