import { useEffect, useState } from 'react';

/** Read dimensions from the existing video without changing playback. */
export function useVideoAspectRatio(video?: HTMLVideoElement) {
  const [ratio, setRatio] = useState('16 / 9');
  useEffect(() => {
    const reset = () => setRatio('16 / 9');
    const measure = () => {
      const width = video?.videoWidth || 0;
      const height = video?.videoHeight || 0;
      setRatio(width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9');
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
  return ratio;
}
