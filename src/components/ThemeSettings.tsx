'use client';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

import {
  type ThemeSetting,
  changeThemeWithTransition,
} from '@/lib/theme-transition';
export default function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const id = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className='tm-menu-theme'>
      <label htmlFor={id}>外观</label>
      <select
        id={id}
        value={mounted ? theme || 'dark' : 'dark'}
        disabled={!mounted}
        onChange={(event) =>
          void changeThemeWithTransition(
            event.currentTarget.value as ThemeSetting,
            setTheme,
            event.currentTarget
          )
        }
      >
        <option value='dark'>深色</option>
        <option value='light'>浅色</option>
        <option value='system'>跟随系统</option>
      </select>
    </div>
  );
}
