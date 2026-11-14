'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAudioFocus } from '@/features/playback/useAudioFocus';

/**
 * 独立播放器（TV 播放页）和房间的边界。
 * TV 页面自己播放、不参与房间同步。人在房间里时房间的影片照常同步
 * （本机不暂停它，否则会变成对整个房间的“暂停”），只是声音交给 TV：
 * 视频真正播放时拿声音归属，其他播放器（包括房间小窗）自动让出声音。
 */
export function useStandalonePlayback() {
  const [element, setElement] = useState<HTMLMediaElement | null>(null);

  const { claimSound } = useAudioFocus(element, false);
  useEffect(() => {
    if (!element) return;
    // 播放器挂载时可能已经开始播放（play 事件早于监听），这时也要拿声音
    if (!element.paused) claimSound();
    element.addEventListener('play', claimSound);
    return () => element.removeEventListener('play', claimSound);
  }, [element, claimSound]);

  const retry = useCallback(() => undefined, []);

  return {
    ready: true,
    error: null as string | null,
    retry,
    bindVideo: setElement,
  };
}
