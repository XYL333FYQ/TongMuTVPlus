'use client';

/*
 * 手机软键盘：可视高度写进 --tm-visual-height；正在输入且可视区域被压矮超过 120 时，算键盘弹起（小窗收成一条）。
 */

import { useEffect, useState } from 'react';

import { viewportSize } from '@/lib/device-tier';

export function useKeyboardVisible() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const height = viewport?.height || viewportSize().height;
      document.documentElement.style.setProperty(
        '--tm-visual-height',
        `${height}px`
      );
      const inputFocused = /^(INPUT|TEXTAREA)$/.test(
        document.activeElement?.tagName || ''
      );
      setKeyboardVisible(inputFocused && viewportSize().height - height > 120);
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  return keyboardVisible;
}
