'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { usePlaybackSession } from './context';
import { useVideoAspectRatio } from './useVideoAspectRatio';

function RouteBridge() {
  const params = useSearchParams();
  const { requestPlayback, controller } = usePlaybackSession();
  const aspectRatio = useVideoAspectRatio(controller?.video);
  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--tm-full-video-aspect-ratio', aspectRatio);
    return () => {
      style.removeProperty('--tm-full-video-aspect-ratio');
    };
  }, [aspectRatio]);
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
