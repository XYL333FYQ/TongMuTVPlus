'use client';

import { useEffect } from 'react';

import { closeTopLayer, getShell } from '@/lib/shell-bridge';

/**
 * 安卓客户端壳的对接点：只在壳里生效，浏览器里什么都不做。
 * 1. 告诉壳“网页已准备好”，壳随即让页面铺满屏幕并注入系统栏高度（CSS 变量）。
 * 2. 主题变化时告诉壳系统栏图标该用深色还是浅色。
 * 3. 提供返回键处理：有弹层先关弹层。
 * 4. 上报“是否在播放”，让壳在切后台时保活。
 */
export default function ShellBridge() {
  useEffect(() => {
    const shell = getShell();
    if (!shell) return;
    shell.ready?.();

    const root = document.documentElement;
    const sync = () => shell.setSystemBars?.(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    // 只读监听页面里的音视频事件（不碰播放器代码），告诉壳现在有没有在播
    let lastPlaying = false;
    const reportPlaying = () => {
      const now = Array.from(
        document.querySelectorAll<HTMLMediaElement>('video,audio')
      ).some((media) => !media.paused && !media.ended);
      if (now === lastPlaying) return;
      lastPlaying = now;
      shell.setPlaying?.(now);
    };
    const mediaEvents = ['play', 'playing', 'pause', 'ended', 'emptied'];
    mediaEvents.forEach((type) =>
      document.addEventListener(type, reportPlaying, true)
    );

    window.__tmShellBack = closeTopLayer;
    return () => {
      mediaEvents.forEach((type) =>
        document.removeEventListener(type, reportPlaying, true)
      );
      observer.disconnect();
      if (window.__tmShellBack === closeTopLayer) delete window.__tmShellBack;
    };
  }, []);

  return null;
}
