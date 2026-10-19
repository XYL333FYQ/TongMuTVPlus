'use client';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

import '@/styles/controls.css';

import { useReducedMotionSetting } from '@/lib/motion';
import {
  type ThemeSetting,
  changeThemeWithTransition,
} from '@/lib/theme-transition';
export default function ThemeSettings() {
  const reduced = useReducedMotionSetting();
  const { theme, setTheme } = useTheme();
  const id = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 挂载前不知道真实主题，先不选中任何一项，避免先亮「深色」再跳走
  const current = mounted ? theme || 'dark' : null;
  return (
    <div className='tm-menu-theme'>
      <span id={id}>外观</span>
      <div
        role='radiogroup'
        aria-labelledby={id}
        className='tm-theme-segments tm-animated-theme'
      >
        {(['dark', 'light', 'system'] as ThemeSetting[]).map(
          (value, index, choices) => (
            <button
              key={value}
              type='button'
              role='radio'
              aria-checked={current === value}
              tabIndex={current === value || (!current && index === 0) ? 0 : -1}
              disabled={!mounted}
              className='tm-press'
              onClick={(event) =>
                void changeThemeWithTransition(
                  value,
                  setTheme,
                  event.currentTarget
                )
              }
              onKeyDown={(event) => {
                if (
                  ![
                    'ArrowLeft',
                    'ArrowRight',
                    'ArrowUp',
                    'ArrowDown',
                    'Home',
                    'End',
                  ].includes(event.key)
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                    ? 2
                    : (index +
                        (['ArrowLeft', 'ArrowUp'].includes(event.key)
                          ? -1
                          : 1) +
                        3) %
                      3;
                const button = event.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement | undefined;
                button?.focus();
                if (button)
                  void changeThemeWithTransition(
                    choices[next],
                    setTheme,
                    button
                  );
              }}
            >
              {current === value && (
                <motion.span
                  className='tm-control-selection'
                  layoutId={reduced ? undefined : `tm-theme-${id}`}
                  initial={false}
                  transition={{
                    duration: reduced ? 0 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden='true'
                />
              )}
              <span className='tm-control-label'>
                {value === 'dark'
                  ? '深色'
                  : value === 'light'
                  ? '浅色'
                  : '跟随系统'}
              </span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
