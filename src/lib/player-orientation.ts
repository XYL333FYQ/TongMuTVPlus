/*
 * 手机全屏时转成横屏（自己看和一起看的播放器共用）。
 *
 * Artplayer 自带的 autoOrientation 在“网页全屏”时会用 CSS 把整个播放器旋转 90°，
 * 控制栏、退出按钮跟着歪掉，用户退不出来（2026-11-17 用户反馈）。两个播放器都关掉了它，
 * 只保留它在“系统全屏”时请求横屏的那一半：横向影片进系统全屏时锁横屏，退出时解锁。
 * 浏览器不支持 screen.orientation.lock（如 iOS Safari）时什么都不做。
 */

interface OrientationLike {
  type?: string;
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

function orientationApi(): OrientationLike | null {
  if (typeof screen === 'undefined') return null;
  return (screen.orientation as OrientationLike | undefined) || null;
}

/** 用到的播放器接口：全屏事件和 video 元素（Artplayer 实例满足它） */
interface FullscreenSource {
  template?: { $video?: HTMLVideoElement };
  on?(event: 'fullscreen', handler: (entered: boolean) => void): unknown;
  off?(event: 'fullscreen', handler: (entered: boolean) => void): unknown;
}

/** 返回取消监听的函数 */
export function lockLandscapeInFullscreen(
  art: FullscreenSource | null | undefined
): () => void {
  let locked = false;
  const onFullscreen = async (entered: boolean) => {
    const orientation = orientationApi();
    if (!orientation?.lock) return;
    if (entered) {
      const video = art?.template?.$video;
      const landscapeVideo =
        !video || !video.videoWidth || video.videoWidth >= video.videoHeight;
      if (!landscapeVideo || orientation.type?.startsWith('landscape')) return;
      try {
        await orientation.lock('landscape');
        locked = true;
      } catch {
        // 不允许锁方向（不在系统全屏、桌面浏览器）：保持原样
      }
    } else if (locked) {
      locked = false;
      try {
        orientation.unlock?.();
      } catch {
        // 忽略
      }
    }
  };
  art?.on?.('fullscreen', onFullscreen);
  return () => {
    art?.off?.('fullscreen', onFullscreen);
    if (locked) {
      locked = false;
      try {
        orientationApi()?.unlock?.();
      } catch {
        // 忽略
      }
    }
  };
}
