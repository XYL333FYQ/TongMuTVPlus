'use client';

import { useEffect } from 'react';

/**
 * 锁屏 / 通知栏媒体控制：只读监听页面里的音视频，把当前页面标题交给系统的 MediaSession，
 * 并让系统的播放/暂停按钮作用到正在播放的那个元素。不碰播放器代码。
 */
export default function MediaSessionBridge() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    const session = navigator.mediaSession;
    let current: HTMLMediaElement | null = null;

    const onPlay = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      current = media;
      try {
        session.metadata = new MediaMetadata({
          title: document.title.split(' · ')[0] || 'TongMuTV Plus',
          artist: 'TongMuTV Plus',
        });
        session.playbackState = 'playing';
      } catch {
        // 个别浏览器不支持 MediaMetadata
      }
    };
    const onPause = (event: Event) => {
      if (event.target === current) {
        try {
          session.playbackState = 'paused';
        } catch {
          // 忽略
        }
      }
    };

    document.addEventListener('play', onPlay, true);
    document.addEventListener('pause', onPause, true);
    try {
      session.setActionHandler('play', () => void current?.play());
      session.setActionHandler('pause', () => current?.pause());
    } catch {
      // 不支持某个动作时忽略
    }
    return () => {
      document.removeEventListener('play', onPlay, true);
      document.removeEventListener('pause', onPause, true);
      try {
        session.setActionHandler('play', null);
        session.setActionHandler('pause', null);
      } catch {
        // 忽略
      }
    };
  }, []);

  return null;
}
