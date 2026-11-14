'use client';

import { CSSProperties, useCallback, useEffect, useState } from 'react';

import { usePlaybackSession } from './context';

export default function PlaybackSlot() {
  const { registerSlot, controller } = usePlaybackSession();
  const [aspectRatio, setAspectRatio] = useState('16 / 9');
  const video = controller?.video;
  useEffect(() => {
    const reset = () => setAspectRatio('16 / 9');
    const measure = () => {
      const width = video?.videoWidth || 0;
      const height = video?.videoHeight || 0;
      setAspectRatio(
        width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9'
      );
    };
    measure();
    video?.addEventListener('loadedmetadata', measure);
    video?.addEventListener('resize', measure);
    video?.addEventListener('emptied', reset);
    return () => {
      video?.removeEventListener('loadedmetadata', measure);
      video?.removeEventListener('resize', measure);
      video?.removeEventListener('emptied', reset);
    };
  }, [video]);
  const ref = useCallback(
    (element: HTMLDivElement | null) => registerSlot(element),
    [registerSlot]
  );
  useEffect(() => () => registerSlot(null), [registerSlot]);
  return (
    <div
      ref={ref}
      className='tm-playback-slot'
      style={{ '--tm-video-aspect-ratio': aspectRatio } as CSSProperties}
      data-tm-playback-slot
      aria-label='房间播放器'
    />
  );
}
