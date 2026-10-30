'use client';

// AI 问片面板按需加载。
// 面板自带 Markdown 渲染器（约 40KB，压缩后），以前被影片卡片直接引用，
// 每个有影片卡片的页面一打开都要先下载它。现在：
//   - 站点没开 AI：永远不下载；
//   - 开了 AI：页面空闲时在后台预载，点开时通常已就绪，打开动画不受影响。

import dynamic from 'next/dynamic';

const loadAIChatPanel = () => import('./AIChatPanel');

let preloaded = false;

/** 页面空闲时预载面板代码（多次调用只会真正下载一次）。 */
export function preloadAIChatPanel(): void {
  if (preloaded || typeof window === 'undefined') return;
  preloaded = true;
  const run = () => void loadAIChatPanel();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}

const AIChatPanel = dynamic(loadAIChatPanel, { ssr: false });

export default AIChatPanel;
