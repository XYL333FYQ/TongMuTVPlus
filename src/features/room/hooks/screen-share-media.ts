/*
 * 屏幕共享的画质档位、ICE 服务器和采集：getDisplayMedia 按档位要画面，读回实际拿到的分辨率和帧率。
 */

export const iceServers = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type ScreenShareQualityPreset = 'smooth' | 'hd' | 'ultra';

export const SCREEN_SHARE_CONSTRAINTS: Record<
  ScreenShareQualityPreset,
  {
    label: string;
    frameRate: number;
    width: number;
    height: number;
  }
> = {
  smooth: {
    label: '流畅 720p / 15fps',
    frameRate: 15,
    width: 1280,
    height: 720,
  },
  hd: {
    label: '高清 1080p / 30fps',
    frameRate: 30,
    width: 1920,
    height: 1080,
  },
  ultra: {
    label: '超清 1440p / 30fps',
    frameRate: 30,
    width: 2560,
    height: 1440,
  },
};

export const screenShareQualityOptions = Object.entries(
  SCREEN_SHARE_CONSTRAINTS
).map(([value, preset]) => ({
  value: value as ScreenShareQualityPreset,
  label: preset.label,
}));

export interface ScreenShareCaptureSettings {
  width: number | null;
  height: number | null;
  frameRate: number | null;
}

/** 按画质档位采集屏幕（带声音） */
export function captureScreen(preset: ScreenShareQualityPreset) {
  const constraints = SCREEN_SHARE_CONSTRAINTS[preset];
  return navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: constraints.frameRate,
      width: { ideal: constraints.width },
      height: { ideal: constraints.height },
    },
    audio: true,
  });
}

/** 浏览器实际给的采集参数（可能比档位低） */
export function captureSettingsOf(
  track: MediaStreamTrack
): ScreenShareCaptureSettings {
  const settings = track.getSettings();
  return {
    width: typeof settings.width === 'number' ? settings.width : null,
    height: typeof settings.height === 'number' ? settings.height : null,
    frameRate:
      typeof settings.frameRate === 'number' ? settings.frameRate : null,
  };
}
