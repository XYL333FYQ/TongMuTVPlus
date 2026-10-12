'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { usePlaybackSession } from './context';

function RouteBridge() {
  const params = useSearchParams();
  const { requestPlayback } = usePlaybackSession();
  const query = params.toString();
  useEffect(() => {
    if (query) requestPlayback(`/play?${query}`);
  }, [query, requestPlayback]);
  return null;
}

export default function PlaybackRoute() {
  return (
    <Suspense fallback={null}>
      <RouteBridge />
    </Suspense>
  );
}
