// 原生客户端壳（安卓手机端）与网页之间的小接口。
// 壳在 WebView 里挂一个 TMShell 对象；浏览器里没有它，下面所有函数都安静地什么都不做。
// 接口只增不改：旧壳缺少某个方法时，调用前先判断，网页不会报错。

import { consumeBackLayer } from '@/lib/back-layers';

export interface TMShellApi {
  /** 网页告诉壳：我认识你，可以让页面铺满整个屏幕了 */
  ready?: () => void;
  /** 系统栏图标深浅：dark=true 表示页面是深色，图标用浅色 */
  setSystemBars?: (dark: boolean) => void;
  /** 短震一下（毫秒） */
  haptic?: (ms: number) => void;
  /** 页面里是否有音视频正在播放：壳据此保活并显示通知栏「正在播放」 */
  setPlaying?: (playing: boolean) => void;
  /** 下载新安装包并调起系统安装界面（仅新版安卓壳有；旧壳没有时网页改为打开下载链接） */
  installUpdate?: (url: string) => void;
}

declare global {
  interface Window {
    TMShell?: TMShellApi;
    /** 壳在按下返回键时调用：网页若有可关闭的弹层就关掉并返回 true */
    __tmShellBack?: () => boolean;
  }
}

export function getShell(): TMShellApi | undefined {
  return typeof window === 'undefined' ? undefined : window.TMShell;
}

/** 触感反馈：壳里走原生振动，普通安卓浏览器走 navigator.vibrate，其余无声跳过。 */
export function haptic(ms = 8) {
  if (typeof window === 'undefined') return;
  try {
    const shell = window.TMShell;
    if (shell?.haptic) shell.haptic(ms);
    else if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch {
    // 振动不可用时忽略
  }
}

/** 关闭请求被接收（含退出动画/处理中拦截）即消费返回，不等待 DOM 移除。 */
export function closeTopLayer(): boolean {
  const focusedControl = document.activeElement;
  // A focused menu/listbox has its own Escape contract and sits above the
  // containing panel. Let that handler consume the request first.
  if (focusedControl?.closest('[role="menu"], [role="listbox"]')) {
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    focusedControl.dispatchEvent(escape);
    if (escape.defaultPrevented || !focusedControl.isConnected) return true;
  }
  // Native dialogs own the platform top layer, including dialogs opened inside
  // another registered panel. Send the same cancel request as Escape, not a
  // synthetic keydown (which does not trigger the browser's default action).
  const focused = document.activeElement?.closest('dialog[open]');
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const native = focused || dialogs[dialogs.length - 1];
  if (native instanceof HTMLDialogElement) {
    const cancel = new Event('cancel', { cancelable: true });
    if (native.dispatchEvent(cancel)) {
      native.close();
    }
    return true;
  }
  const result = consumeBackLayer();
  if (result !== 'pass') return true;
  const layers = document.querySelectorAll(
    '[role="dialog"][aria-modal="true"]'
  );
  if (!layers.length) return false;
  const top = layers[layers.length - 1];
  const escape = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  top.dispatchEvent(escape);
  return escape.defaultPrevented || !document.contains(top);
}
