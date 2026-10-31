'use client';

import { useEffect } from 'react';

import { closeTopLayer, getShell } from '@/lib/shell-bridge';

/** 主题过渡标记最长等多久：比最长的过渡时长（约 0.5 秒）宽裕得多 */
const THEME_SETTLE_FALLBACK_MS = 1500;

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
    // 系统栏通知会让壳改窗口标志、重画 WebView 底色，是一次原生窗口级的重排。
    // 主题圆形过渡正在播时（根元素带 data-tm-theme-transition）先不通知，等过渡收尾再发，
    // 免得原生那一下恰好落在动画前几帧里造成卡顿；没有过渡（减少动效、旧浏览器）就立刻发。
    let settleTimer = 0;
    const push = () => {
      window.clearTimeout(settleTimer);
      shell.setSystemBars?.(root.classList.contains('dark'));
    };
    const sync = () => {
      window.clearTimeout(settleTimer);
      if (root.hasAttribute('data-tm-theme-transition')) {
        // 兜底：过渡标记万一没清掉，也要把最终主题告诉壳
        settleTimer = window.setTimeout(push, THEME_SETTLE_FALLBACK_MS);
        return;
      }
      push();
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    const settleObserver = new MutationObserver(() => {
      if (!root.hasAttribute('data-tm-theme-transition')) push();
    });
    settleObserver.observe(root, {
      attributes: true,
      attributeFilter: ['data-tm-theme-transition'],
    });

    // 只读监听页面里的音视频事件（不碰播放器代码），告诉壳现在有没有在播
    let lastPlaying: boolean | undefined;
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
    // Mount/removal need not emit play/pause (for example a failed renderer or
    // a removed music element). Keep native service state tied to actual media.
    const hasMedia = (node: Node) =>
      node instanceof Element &&
      (node.matches('video,audio') ||
        Boolean(node.querySelector('video,audio')));
    const mediaObserver = new MutationObserver((records) => {
      if (
        records.some((record) =>
          [
            ...Array.from(record.addedNodes),
            ...Array.from(record.removedNodes),
          ].some(hasMedia)
        )
      )
        reportPlaying();
    });
    mediaObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    reportPlaying();

    window.__tmShellBack = closeTopLayer;
    return () => {
      mediaEvents.forEach((type) =>
        document.removeEventListener(type, reportPlaying, true)
      );
      mediaObserver.disconnect();
      observer.disconnect();
      settleObserver.disconnect();
      window.clearTimeout(settleTimer);
      if (window.__tmShellBack === closeTopLayer) delete window.__tmShellBack;
    };
  }, []);

  return null;
}
