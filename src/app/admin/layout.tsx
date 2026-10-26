import type { Metadata } from 'next';

import './admin-ui.css';

// 浏览器标签页标题：「管理面板 · 站点名」（模板在根布局）
export const metadata: Metadata = { title: '管理面板' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
