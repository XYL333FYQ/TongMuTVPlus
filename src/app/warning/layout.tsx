import type { Metadata } from 'next';

// 浏览器标签页标题：「安全提示 · 站点名」（模板在根布局）
export const metadata: Metadata = { title: '安全提示' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
