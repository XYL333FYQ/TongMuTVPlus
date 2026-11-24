/*
 * 小插件：防息屏、倍速记忆（含 Safari 重置补救）、自定义进度条图标、iOS 全屏。
 * 触屏快进快退和全屏退出按钮两个播放器共用，见 src/lib/player-touch-controls.ts。
 */

import { isHandheld, isInstalledWebApp, matchesMedia } from '@/lib/device-tier';
import { readSetting, writeSetting } from '@/lib/settings';

import type { Art } from '../art-types';
import { playerEnvironment } from '../env';
import type { PlayerPlugin } from '../WatchPlayer';

// ------------------------------------------------------------ 防息屏

export const wakeLockPlugin: PlayerPlugin = ({ art }) => {
  let sentinel: { release(): Promise<void> } | null = null;
  const request = async () => {
    try {
      if ('wakeLock' in navigator && !sentinel)
        sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // 不支持或被拒绝
    }
  };
  const release = async () => {
    const current = sentinel;
    sentinel = null;
    try {
      await current?.release();
    } catch {
      // 忽略
    }
  };
  // 切回页面时浏览器会自动释放，需要重新申请
  const onVisible = () => {
    if (document.visibilityState === 'visible' && !art.paused) {
      sentinel = null;
      void request();
    }
  };
  art.on('play', request);
  art.on('pause', release);
  art.on('video:ended', release);
  document.addEventListener('visibilitychange', onVisible);
  if (!art.paused) void request();
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    void release();
  };
};

// ------------------------------------------------------------ 倍速记忆

const RATE_KEY = 'preferredPlaybackRate';

export function savedPlaybackRate() {
  const value = Number(readSetting(RATE_KEY));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * 记住自己的倍速。remoteRate 返回非空时（一起看跟随房间倍速），不记录也不恢复。
 * Safari 在换片 / 跳转后会把倍速重置为 1，这里在短时间内恢复回去。
 */
export function playbackRatePlugin(
  remoteRate: () => number | null = () => null
): PlayerPlugin {
  return ({ art, later }) => {
    const webkit = playerEnvironment().webkit;
    let last = savedPlaybackRate();
    let restoreUntil = Date.now() + 4000;
    const keepPitch = () => {
      const video = art.video as HTMLVideoElement & {
        webkitPreservesPitch?: boolean;
      };
      if (!webkit || !video) return;
      if ('preservesPitch' in video) video.preservesPitch = true;
      if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = true;
    };
    const restore = () => {
      const target = remoteRate() ?? last;
      if (Math.abs((art.playbackRate || 1) - target) > 0.01)
        art.playbackRate = target;
    };
    art.on('video:ratechange', () => {
      const rate = art.playbackRate;
      if (remoteRate() !== null) return keepPitch();
      if (
        webkit &&
        Date.now() < restoreUntil &&
        Math.abs(rate - 1) < 0.01 &&
        last > 1
      ) {
        later(restore, 0);
        return keepPitch();
      }
      last = rate;
      writeSetting(RATE_KEY, String(rate));
      keepPitch();
    });
    art.on('video:canplay', () => {
      restoreUntil = Date.now() + 4000;
      later(() => {
        const video = art.video as HTMLVideoElement | undefined;
        // Safari 刚跳转进度时立刻改倍速，容易卡在 seeking：等跳转完成（最多 300ms）再恢复
        if (webkit && video?.seeking) {
          let done = false;
          const apply = () => {
            if (done) return;
            done = true;
            video.removeEventListener('seeked', apply);
            restore();
            keepPitch();
          };
          video.addEventListener('seeked', apply, { once: true });
          later(apply, 300);
          return;
        }
        restore();
        keepPitch();
      }, 0);
    });
    art.on('video:playing', () => {
      if (webkit && Date.now() < restoreUntil) restore();
    });
  };
}

export function stepPlaybackRate(art: Art, rates: number[], direction: 1 | -1) {
  const current = art.playbackRate || 1;
  let next = current;
  if (direction > 0)
    next = rates.find((rate) => rate > current + 0.01) ?? current;
  else
    next =
      [...rates].reverse().find((rate) => rate < current - 0.01) ?? current;
  art.playbackRate = next;
  art.notice.show =
    next === current
      ? direction > 0
        ? `已是最高倍速：${next}x`
        : `已是最低倍速：${next}x`
      : `倍速：${next}x`;
}

// 全屏快进快退按钮：和自己看共用，见 src/lib/player-touch-controls.ts

// ------------------------------------------------------------ 进度条图标

const THUMB_PRESETS: Record<string, { url: string; size?: [number, number] }> =
  {
    renako: { url: '/icons/q/renako.png', size: [26.875, 37.5] },
    irena: { url: '/icons/q/irena.png' },
    emilia: { url: '/icons/q/emilia.png' },
  };

/** 后台可配置的进度条拖动图标 */
export const progressThumbPlugin: PlayerPlugin = ({ art }) => {
  const config = window.RUNTIME_CONFIG;
  const id = 'tm-progress-thumb-style';
  document.getElementById(id)?.remove();
  if (
    !config ||
    !config.PROGRESS_THUMB_TYPE ||
    config.PROGRESS_THUMB_TYPE === 'default'
  )
    return;
  let url = '';
  let size: [number, number] = [30, 30];
  if (config.PROGRESS_THUMB_TYPE === 'preset') {
    const preset = THUMB_PRESETS[config.PROGRESS_THUMB_PRESET_ID ?? ''];
    if (preset) {
      url = preset.url;
      if (preset.size) size = preset.size;
    }
  } else if (config.PROGRESS_THUMB_TYPE === 'custom')
    url = config.PROGRESS_THUMB_CUSTOM_URL || '';
  if (!url) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `.art-video-player .art-progress-indicator{width:${
    size[0]
  }px!important;height:${size[1]}px!important;margin-left:-${
    size[0] / 2
  }px!important;background:url('${url.replace(
    /'/g,
    "\\'"
  )}') center/contain no-repeat!important;border:0!important;border-radius:0!important;box-shadow:none!important}`;
  document.head.appendChild(style);
  void art;
  return () => style.remove();
};

// ------------------------------------------------------------ iOS 全屏

/**
 * iOS 原生全屏会切到系统播放器（没有弹幕）。
 * iPhone 直接用系统全屏；iPad 添加到主屏幕时网页全屏，否则让用户选网页全屏或系统全屏。
 */
export function iosFullscreenControl(
  getArt: () => Art | null,
  choose: () => Promise<'web' | 'native' | null>
) {
  return {
    name: 'tm-ios-fullscreen',
    position: 'right',
    index: 100,
    tooltip: '全屏',
    html: '<i class="art-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></i>',
    click: async () => {
      const art = getArt();
      if (!art) return;
      const doc = document;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        try {
          await exit?.call(document);
        } catch {
          // 忽略
        }
        return;
      }
      if (art.fullscreenWeb) {
        art.fullscreenWeb = false;
        return;
      }
      const nativeFullscreen = () => {
        const video = art.template?.$video;
        if (video?.requestFullscreen) video.requestFullscreen();
        else video?.webkitEnterFullscreen?.();
      };
      // iPhone：直接用系统全屏（会自己横过来）。网页全屏在竖着的手机上只是中间一小条画面，
      // 按钮还会被挤出屏幕（2026-11-18 问题文档第 6 条）。iPad 仍可以选
      if (isHandheld()) return nativeFullscreen();
      const standalone = isInstalledWebApp();
      if (standalone) {
        art.fullscreenWeb = true;
        return;
      }
      const choice = await choose();
      if (choice === 'web') art.fullscreenWeb = true;
      if (choice === 'native') nativeFullscreen();
    },
  };
}

/** iOS 横屏时网页全屏需要重新进入一次才能铺满 */
export const iosOrientationPlugin: PlayerPlugin = ({ art, later }) => {
  if (!playerEnvironment().ios) return;
  const onChange = () => {
    if (!art.fullscreenWeb) return;
    if (!matchesMedia('(orientation: landscape)')) return;
    art.fullscreenWeb = false;
    later(() => {
      art.fullscreenWeb = true;
    }, 100);
  };
  window.addEventListener('orientationchange', onChange);
  return () => window.removeEventListener('orientationchange', onChange);
};
