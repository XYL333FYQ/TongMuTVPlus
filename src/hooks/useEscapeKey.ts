import { useEffect } from 'react';

/**
 * 按 Esc 触发关闭。给还没改用原生模态层的浮层补键盘退出；
 * enabled 为 false 时不监听（嵌套确认框打开时，外层面板先让路）。
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}
