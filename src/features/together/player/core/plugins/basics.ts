/*
 * 小插件：防息屏、倍速记忆（含 Safari 重置补救）、移动端全屏快进快退按钮、
 * 自定义进度条图标、iOS 全屏选择。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { calculateSeekTime } from '@/lib/player-seek-settings';

import { formatDuration } from './format';
import { playerEnvironment } from '../env';
import type { PlayerPlugin } from '../WatchPlayer';

// ------------------------------------------------------------ 防息屏

export const wakeLockPlugin: PlayerPlugin = ({ art }) => {
  let sentinel: { release(): Promise<void> } | null = null;
  const request = async () => {
    try {
      if ('wakeLock' in navigator && !sentinel)
        sentinel = await (navigator as any).wakeLock.request('screen');
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
  try {
    const value = Number(localStorage.getItem(RATE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 1;
  } catch {
    return 1;
  }
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
      try {
        localStorage.setItem(RATE_KEY, String(rate));
      } catch {
        // 忽略
      }
      keepPitch();
    });
    art.on('video:canplay', () => {
      restoreUntil = Date.now() + 4000;
      later(() => {
        restore();
        keepPitch();
      }, 0);
    });
    art.on('video:playing', () => {
      if (webkit && Date.now() < restoreUntil) restore();
    });
  };
}

export function stepPlaybackRate(art: any, rates: number[], direction: 1 | -1) {
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

// ------------------------------------------------------------ 全屏快进快退按钮

/** 手机全屏时屏幕两侧显示快退 / 快进按钮 */
export function seekButtonsPlugin(stepSeconds: () => number): PlayerPlugin {
  return ({ art }) => {
    const layer = art.layers.add({
      name: 'tm-seek-buttons',
      html: `<div class="tm-seek-buttons" hidden>
          <button type="button" class="tm-seek-button" data-dir="-1" aria-label="快退">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          </button>
          <button type="button" class="tm-seek-button" data-dir="1" aria-label="快进">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </button>
        </div>`,
      style: { pointerEvents: 'none', inset: '0', position: 'absolute' },
    });
    const root = (layer || art.layers['tm-seek-buttons']) as HTMLElement;
    const box = root?.querySelector('.tm-seek-buttons') as HTMLElement | null;
    if (!box) return;
    box.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const direction = Number(button.dataset.dir) as 1 | -1;
        const seconds = stepSeconds();
        art.currentTime = calculateSeekTime(
          art.currentTime,
          art.duration,
          direction,
          seconds
        );
        art.notice.show = `${direction > 0 ? '快进' : '快退'} ${formatDuration(
          seconds
        )}`;
      };
    });
    const update = () => {
      const fullscreen =
        art.fullscreen || art.fullscreenWeb || !!document.fullscreenElement;
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 768;
      const controlsVisible =
        !art.template?.$player?.classList.contains('art-hide-cursor');
      box.hidden = !(fullscreen && mobile && controlsVisible);
    };
    const observer = new MutationObserver(update);
    if (art.template?.$player)
      observer.observe(art.template.$player, {
        attributes: true,
        attributeFilter: ['class'],
      });
    art.on('fullscreen', update);
    art.on('fullscreenWeb', update);
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('resize', update);
    };
  };
}

// ------------------------------------------------------------ 进度条图标

const THUMB_PRESETS: Record<string, { url: string; size?: [number, number] }> =
  {
    renako: { url: '/icons/q/renako.png', size: [26.875, 37.5] },
    irena: { url: '/icons/q/irena.png' },
    emilia: { url: '/icons/q/emilia.png' },
  };

/** 后台可配置的进度条拖动图标 */
export const progressThumbPlugin: PlayerPlugin = ({ art }) => {
  const config = (window as any).RUNTIME_CONFIG;
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
    const preset = THUMB_PRESETS[config.PROGRESS_THUMB_PRESET_ID];
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
 * 添加到主屏幕时直接全屏，否则让用户选网页全屏或系统全屏。
 */
export function iosFullscreenControl(
  getArt: () => any,
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
      const doc = document as any;
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
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (navigator as any).standalone === true;
      if (standalone) {
        art.fullscreenWeb = true;
        return;
      }
      const choice = await choose();
      if (choice === 'web') art.fullscreenWeb = true;
      if (choice === 'native') {
        const video = art.template?.$video as any;
        if (video?.requestFullscreen) video.requestFullscreen();
        else video?.webkitEnterFullscreen?.();
      }
    },
  };
}

/** iOS 横屏时网页全屏需要重新进入一次才能铺满 */
export const iosOrientationPlugin: PlayerPlugin = ({ art, later }) => {
  if (!playerEnvironment().ios) return;
  const onChange = () => {
    if (!art.fullscreenWeb) return;
    if (!window.matchMedia('(orientation: landscape)').matches) return;
    art.fullscreenWeb = false;
    later(() => {
      art.fullscreenWeb = true;
    }, 100);
  };
  window.addEventListener('orientationchange', onChange);
  return () => window.removeEventListener('orientationchange', onChange);
};
