'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { usePlaybackSession } from './context';
import { useVideoAspectRatio } from './useVideoAspectRatio';

function RouteBridge() {
  const params = useSearchParams();
  const { requestPlayback, controller, href } = usePlaybackSession();
  const currentHref = useRef(href);
  const initialNavigation = useRef(true);
  currentHref.current = href;
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
    const first = initialNavigation.current;
    initialNavigation.current = false;
    if (query && (first || currentHref.current !== `/play?${query}`))
      requestPlayback(`/play?${query}`, 'personal');
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
