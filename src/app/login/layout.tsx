import type { Metadata } from 'next';

// 浏览器标签页标题：「登录 · 站点名」（模板在根布局）
export const metadata: Metadata = { title: '登录' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
