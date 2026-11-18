/*
 * 触屏播放控件（自己看和房间两个播放器共用，2026-11-18 设计稿）。
 *
 * 触屏（手机竖 / 横、平板竖 / 横）上，控制条出现时画面正中是一组：快退 · 播放暂停 · 快进；
 * 手机两档全屏时左上角多一个“退出全屏”。锁按钮在左边中间（样式见 player-controls.css），
 * 所以快退快进和锁不会再叠在一起。以前两个播放器各写一套快进快退，位置、样子都不一样。
 *
 * 只依赖 Artplayer 实例本身；“快退快进多少秒”、“这个人能不能操作进度”由调用方给。
 */

import { calculateSeekTime } from '@/lib/player-seek-settings';

import { getDeviceTier, onDeviceTierChange } from './device-tier';

// Artplayer 的实例类型没有导出完整声明，这里只用到下面这些
interface TouchArt {
  currentTime: number;
  duration: number;
  playing: boolean;
  fullscreen: boolean;
  fullscreenWeb: boolean;
  notice: { show: string };
  template?: { $player?: HTMLElement };
  layers: { add(option: Record<string, unknown>): HTMLElement | undefined };
  on(name: string, handler: (...args: unknown[]) => void): void;
  off?(name: string, handler: (...args: unknown[]) => void): void;
  toggle(): void;
}

export interface TouchControlsOptions {
  /** 一次快退 / 快进多少秒 */
  stepSeconds(): number;
  /** 不能操作进度和播放时（房间里没有播放权限的成员）整组不出现 */
  locked?(): boolean;
  /** 退出全屏（各播放器的全屏方式不同：系统全屏 / 网页全屏 / iOS 原生） */
  exitFullscreen(): void;
}

function formatStep(seconds: number) {
  return seconds >= 60 && seconds % 60 === 0
    ? `${seconds / 60} 分钟`
    : `${seconds} 秒`;
}

const ICONS = {
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  forward:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  play: '<svg class="tm-touch-icon-play" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.5-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
  pause:
    '<svg class="tm-touch-icon-pause" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  exit: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
};

/**
 * 要不要中间那一组：看是不是触屏，不看档位。
 * 平板横屏和电脑同一档（wide），但没有键盘的方向键，必须有按钮快退快进（2026-11-18 问题合集）。
 */
export function wantsTouchCluster() {
  return !!window.matchMedia?.('(pointer: coarse)').matches;
}

export function installTouchControls(
  art: TouchArt,
  options: TouchControlsOptions
): () => void {
  const root = art.layers.add({
    name: 'tm-touch',
    html: `<div class="tm-touch" hidden>
        <button type="button" class="tm-touch-btn" data-act="back"></button>
        <button type="button" class="tm-touch-btn" data-act="toggle" data-size="lg"></button>
        <button type="button" class="tm-touch-btn" data-act="forward"></button>
      </div>
      <button type="button" class="tm-touch-btn tm-touch-exit" data-act="exit" aria-label="退出全屏" title="退出全屏" hidden>${ICONS.exit}</button>`,
    style: {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    },
  });
  const layer =
    root ||
    (art.template?.$player?.querySelector('.art-layer-tm-touch') as
      | HTMLElement
      | undefined);
  const cluster = layer?.querySelector<HTMLElement>('.tm-touch');
  const exit = layer?.querySelector<HTMLButtonElement>('.tm-touch-exit');
  if (!layer || !cluster || !exit) return () => undefined;
  const back = cluster.querySelector<HTMLButtonElement>('[data-act="back"]')!;
  const toggle = cluster.querySelector<HTMLButtonElement>(
    '[data-act="toggle"]'
  )!;
  const forward = cluster.querySelector<HTMLButtonElement>(
    '[data-act="forward"]'
  )!;
  back.innerHTML = ICONS.back;
  forward.innerHTML = ICONS.forward;
  toggle.innerHTML = ICONS.play + ICONS.pause;

  const labels = () => {
    const step = formatStep(options.stepSeconds());
    back.setAttribute('aria-label', `快退 ${step}`);
    forward.setAttribute('aria-label', `快进 ${step}`);
    toggle.setAttribute('aria-label', art.playing ? '暂停' : '播放');
    toggle.dataset.playing = String(!!art.playing);
  };

  const seek = (direction: 1 | -1) => {
    const seconds = options.stepSeconds();
    art.currentTime = calculateSeekTime(
      art.currentTime,
      art.duration,
      direction,
      seconds
    );
    art.notice.show = `${direction > 0 ? '快进' : '快退'} ${formatStep(
      seconds
    )}`;
  };

  // 按钮在画面上：点它不能同时算成“点画面”（那会暂停 / 出控制条）
  [back, toggle, forward, exit].forEach((button) =>
    ['click', 'dblclick', 'pointerdown', 'touchstart', 'mousedown'].forEach(
      (name) =>
        button.addEventListener(name, (event) => event.stopPropagation())
    )
  );
  back.addEventListener('click', () => seek(-1));
  forward.addEventListener('click', () => seek(1));
  toggle.addEventListener('click', () => {
    art.toggle();
    labels();
  });
  exit.addEventListener('click', () => options.exitFullscreen());

  const player = art.template?.$player;
  const update = () => {
    const controlsVisible = !player?.classList.contains('art-hide-cursor');
    const locked = !!options.locked?.();
    const lockedScreen = !!player?.classList.contains('art-lock');
    const fullscreen =
      art.fullscreen || art.fullscreenWeb || !!document.fullscreenElement;
    const touch = wantsTouchCluster();
    const handheld =
      getDeviceTier() === 'phone' || getDeviceTier() === 'phone-landscape';
    cluster.hidden = !(touch && controlsVisible && !locked && !lockedScreen);
    exit.hidden = !(handheld && fullscreen && controlsVisible && !lockedScreen);
    player?.toggleAttribute('data-tm-touch', touch);
    labels();
  };

  const observer = new MutationObserver(update);
  if (player)
    observer.observe(player, { attributes: true, attributeFilter: ['class'] });
  const events = [
    'fullscreen',
    'fullscreenWeb',
    'play',
    'pause',
    'video:play',
    'video:pause',
  ];
  events.forEach((name) => art.on(name, update));
  document.addEventListener('fullscreenchange', update);
  const offTier = onDeviceTierChange(update);
  update();
  return () => {
    observer.disconnect();
    events.forEach((name) => art.off?.(name, update));
    document.removeEventListener('fullscreenchange', update);
    offTier();
  };
}
