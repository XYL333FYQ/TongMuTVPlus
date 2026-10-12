'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { changeThemeWithTransition } from '@/lib/theme-transition';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // 渲染一个占位符以避免布局偏移
    return <span className='tm-theme-toggle-placeholder' aria-hidden='true' />;
  }

  const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type='button'
      onClick={(event) =>
        void changeThemeWithTransition(
          targetTheme,
          setTheme,
          event.currentTarget
        )
      }
      className='tm-theme-toggle tm-press'
      aria-label={targetTheme === 'light' ? '切换到浅色' : '切换到深色'}
    >
      {resolvedTheme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
