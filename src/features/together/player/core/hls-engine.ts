/*
 * hls.js 接入：缓冲策略、去广告 loader、Safari 卡启动的补救、错误转成中文提示。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdFilterLoader } from './ad-filter';
import { playerEnvironment } from './env';
import { isProxyM3u8Url } from './source-policy';

export type BufferStrategy = 'low' | 'medium' | 'high' | 'ultra';

const BUFFER_PRESETS: Record<
  BufferStrategy,
  { maxBufferLength: number; backBufferLength: number; maxBufferSize: number }
> = {
  low: { maxBufferLength: 15, backBufferLength: 15, maxBufferSize: 30e6 },
  medium: { maxBufferLength: 30, backBufferLength: 30, maxBufferSize: 60e6 },
  high: { maxBufferLength: 60, backBufferLength: 40, maxBufferSize: 120e6 },
  ultra: { maxBufferLength: 120, backBufferLength: 60, maxBufferSize: 240e6 },
};

export function readBufferStrategy(): BufferStrategy {
  try {
    const value = localStorage.getItem('bufferStrategy');
    if (value && value in BUFFER_PRESETS) return value as BufferStrategy;
  } catch {
    // 隐私模式
  }
  return 'medium';
}

/**
 * minAhead：至少提前缓冲多少秒。一起看用 120 秒，网络时快时慢也能撑住，
 * 不会因为一个人卡而拖住整个房间。
 */
export function bufferConfig(strategy: BufferStrategy, minAhead = 0) {
  const preset = BUFFER_PRESETS[strategy] || BUFFER_PRESETS.medium;
  if (!minAhead) return preset;
  return {
    maxBufferLength: Math.max(preset.maxBufferLength, minAhead),
    backBufferLength: Math.min(preset.backBufferLength, 30),
    maxBufferSize: Math.max(preset.maxBufferSize, 200e6),
  };
}

export interface HlsAttachOptions {
  adBlock: boolean;
  strategy: BufferStrategy;
  minAhead: number;
  source: () => string;
  /** 任务计时器：播放器销毁时一起清掉 */
  later: (fn: () => void, ms: number) => void;
  /** 清单解析完：小雅 / OpenList 链接需要定时刷新 */
  onManifest?: (hls: any, video: HTMLVideoElement) => void;
  /** 清单 403：交给链接刷新处理，返回 true 表示已处理 */
  onForbidden?: (hls: any, video: HTMLVideoElement) => boolean;
  onFatal: (message: string, info?: { corsFailedUrl?: string }) => void;
  shouldAutoPlay: () => boolean;
  play: () => void;
}

/** hls.js 还没把视频接上时（Safari 偶发），重新接一次 */
export function needsWebkitRescue(video: HTMLVideoElement & { hls?: any }) {
  const hls = video.hls;
  if (!hls) return false;
  let buffered = false;
  try {
    buffered = video.buffered.length > 0;
  } catch {
    buffered = false;
  }
  if (video.readyState > 0 || buffered) return false;
  const src = video.currentSrc || video.src || '';
  const mseState = hls.bufferController?.mediaSource?.readyState || '';
  return !(src.startsWith('blob:') && mseState !== 'closed');
}

export function rescueWebkitHls(
  video: HTMLVideoElement & { hls?: any },
  later: (fn: () => void, ms: number) => void,
  stillCurrent: () => boolean
) {
  if (!playerEnvironment().webkit) return;
  [1500, 3500, 6000].forEach((delay) =>
    later(() => {
      if (!stillCurrent() || !needsWebkitRescue(video)) return;
      try {
        video.hls.detachMedia?.();
        video.hls.attachMedia?.(video);
        video.hls.startLoad?.(-1);
        video.play().catch(() => undefined);
      } catch {
        // 补救失败就等用户手动重试
      }
    }, delay)
  );
}

function statusMessage(status: number) {
  if (status === 403) return '访问被拒绝 (403)';
  if (status === 404) return '视频不存在 (404)';
  if (status === 415) return '视频格式不兼容 (415)';
  return `HTTP ${status} 错误`;
}

export function attachHls(
  Hls: any,
  video: HTMLVideoElement & { hls?: any },
  url: string,
  options: HlsAttachOptions
) {
  if (video.hls) video.hls.destroy();
  const buffer = bufferConfig(options.strategy, options.minAhead);
  const hls = new Hls({
    debug: false,
    enableWorker: true,
    lowLatencyMode: false,
    autoStartLoad: true,
    ...buffer,
    loader: options.adBlock
      ? createAdFilterLoader(Hls, options.source)
      : Hls.DefaultConfig.loader,
  });

  const kick = () => {
    try {
      hls.startLoad(-1);
    } catch {
      // 忽略
    }
    if (!video.paused) video.play().catch(() => undefined);
  };
  hls.on(Hls.Events.MEDIA_ATTACHED, kick);

  video.hls = hls;
  hls.loadSource(url);
  hls.attachMedia(video);

  if (playerEnvironment().webkit)
    options.later(() => {
      if (!needsWebkitRescue(video)) return;
      try {
        hls.detachMedia();
        hls.attachMedia(video);
        kick();
      } catch {
        // 忽略
      }
    }, 3000);

  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    if (video.paused && options.shouldAutoPlay()) options.play();
    options.onManifest?.(hls, video);
  });

  hls.on(Hls.Events.ERROR, (_event: unknown, data: any) => {
    if (!data?.fatal) return;
    const status = data.response?.code || data.response?.status;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      if (data.details === 'manifestLoadError') {
        if (status === 403 && options.onForbidden?.(hls, video)) return;
        hls.destroy();
        if (status) return options.onFatal(statusMessage(status));
        return options.onFatal(
          '无法访问视频源（可能是跨域限制或访问被拒绝）',
          options.source() === 'directplay' && !isProxyM3u8Url(url)
            ? { corsFailedUrl: url }
            : undefined
        );
      }
      if (status && status >= 400) {
        hls.destroy();
        return options.onFatal(statusMessage(status));
      }
      hls.startLoad();
      return;
    }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      hls.recoverMediaError();
      return;
    }
    hls.destroy();
    options.onFatal('视频加载错误');
  });

  return hls;
}
