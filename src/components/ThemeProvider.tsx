'use client';

import type { ThemeProviderProps } from 'next-themes';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

import { useVisualPreferences } from '@/hooks/useVisualPreferences';

function ThemeEnvironment() {
  // Restore the existing browser preferences even on pages without controls.
  useVisualPreferences();
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      // 主题圆形过渡还在播：等它收尾再改地址栏 / 状态栏颜色。
      // 改 theme-color 会让手机浏览器重画整条工具栏，落在动画前几帧里就是一顿
      if (root.hasAttribute('data-tm-theme-transition')) return;
      let meta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]'
      );
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = getComputedStyle(root).getPropertyValue('--tm-bg').trim();
    };
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-tm-theme-transition'],
    });
    update();
    return () => observer.disconnect();
  }, []);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute='class'
      defaultTheme='dark'
      enableSystem
      {...props}
    >
      <ThemeEnvironment />
      {children}
    </NextThemesProvider>
  );
}
