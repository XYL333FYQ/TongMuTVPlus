import { useLayoutEffect } from 'react';

/**
 * 沉浸模式：页面要占满屏幕时，请站点外壳让开，而不是在页面样式里去改外壳的元素。
 *
 * - `bare`：顶栏、手机顶栏、底栏都不显示，外壳给它们留的位置也收回来（手机、触屏平板上的房间页）。
 * - `fit`：外壳照常显示，主区域不留上下空白、不撑满一屏（窄的电脑窗口上的房间页，一屏装下）。
 * - `flush`：外壳照常显示，只是主区域不留底部空白（电脑上的房间页，画面和聊天一直到底）。
 *
 * 写在 html[data-tm-immersive] 上，规则在 styles/shell.css。页面卸载时恢复。
 */
export type ImmersiveShellMode = 'bare' | 'fit' | 'flush';

export function useImmersiveShell(mode: ImmersiveShellMode | null) {
  useLayoutEffect(() => {
    if (!mode) return;
    const root = document.documentElement;
    root.dataset.tmImmersive = mode;
    return () => {
      if (root.dataset.tmImmersive === mode) delete root.dataset.tmImmersive;
    };
  }, [mode]);
}
