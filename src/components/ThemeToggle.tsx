'use client';

import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';

import { changeThemeWithTransition } from '@/lib/theme-transition';

// 8 道光线：从圆心 7.6 到 10 的短线，月亮状态下整组收拢并淡出。
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return `M${(12 + c * 7.6).toFixed(2)} ${(12 + s * 7.6).toFixed(2)}L${(
    12 +
    c * 10
  ).toFixed(2)} ${(12 + s * 10).toFixed(2)}`;
}).join('');

/**
 * 日月是同一个图形：圆盘在太阳（缩小）与月亮（放大）之间缩放，
 * 一个遮罩圆从右上角滑入把圆盘咬成弯月，光线同时收拢淡出。
 * 状态由父按钮的 data-tm-celestial 驱动，动画全在 CSS（primitives.css）。
 */
function CelestialMorph() {
  const maskId = useId();
  return (
    <svg
      className='tm-theme-morph'
      viewBox='0 0 24 24'
      fill='none'
      aria-hidden='true'
      focusable='false'
    >
      <mask id={maskId}>
        <rect width='24' height='24' fill='white' />
        <circle className='tm-morph-bite' cx='17' cy='7' r='7' fill='black' />
      </mask>
      <circle
        className='tm-morph-disc'
        cx='12'
        cy='12'
        r='9'
        fill='currentColor'
        mask={`url(#${maskId})`}
      />
      <path
        className='tm-morph-rays'
        d={RAYS}
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  );
}

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

  const isDark = resolvedTheme === 'dark';
  const targetTheme = isDark ? 'light' : 'dark';

  return (
    <button
      type='button'
      data-tm-celestial={isDark ? 'solar' : 'lunar'}
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
      <span className='tm-theme-emblem' aria-hidden='true'>
        <span className='tm-theme-emblem-orbit' />
        <span className='tm-theme-emblem-core'>
          <CelestialMorph />
        </span>
      </span>
    </button>
  );
}
