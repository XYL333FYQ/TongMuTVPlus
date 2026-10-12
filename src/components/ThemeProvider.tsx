'use client';

import type { ThemeProviderProps } from 'next-themes';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

import { useVisualPreferences } from '@/hooks/useVisualPreferences';

function ThemeEnvironment() {
  // Restore the existing browser preferences even on pages without controls.
  useVisualPreferences();
  React.useEffect(() => {
    const update = () => {
      let meta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]'
      );
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = getComputedStyle(document.documentElement)
        .getPropertyValue('--tm-bg')
        .trim();
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
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
