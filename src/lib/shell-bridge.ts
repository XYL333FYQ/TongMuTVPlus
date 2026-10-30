// 原生客户端壳（安卓手机端）与网页之间的小接口。
// 壳在 WebView 里挂一个 TMShell 对象；浏览器里没有它，下面所有函数都安静地什么都不做。
// 接口只增不改：旧壳缺少某个方法时，调用前先判断，网页不会报错。

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

/** 关闭最上层的弹层。真的关掉了才返回 true，否则交还给浏览器历史后退。 */
export function closeTopLayer(): boolean {
  const layers = document.querySelectorAll(
    '[role="dialog"][aria-modal="true"]'
  );
  if (!layers.length) return false;
  const top = layers[layers.length - 1];
  top.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  return !document.contains(top);
}
