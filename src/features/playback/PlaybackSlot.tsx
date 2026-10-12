'use client';

import { useCallback, useEffect } from 'react';

import { usePlaybackSession } from './context';

export default function PlaybackSlot() {
  const { registerSlot } = usePlaybackSession();
  const ref = useCallback(
    (element: HTMLDivElement | null) => registerSlot(element),
    [registerSlot]
  );
  useEffect(() => () => registerSlot(null), [registerSlot]);
  return (
    <div
      ref={ref}
      className='tm-playback-slot'
      data-tm-playback-slot
      aria-label='房间播放器'
    />
  );
}
