/*
 * 键盘快捷键。只在页面焦点不在输入框 / 按钮上时生效。
 */

import { calculateSeekTime } from '@/lib/player-seek-settings';

import { stepPlaybackRate } from './basics';
import { formatDuration } from './format';
import { PLAYBACK_RATES, WatchPlayer } from '../WatchPlayer';

export const SHORTCUT_GROUPS = [
  {
    title: '播放',
    items: [
      { keys: ['空格'], description: '播放 / 暂停' },
      { keys: ['←', '→'], description: '快退 / 快进' },
      { keys: ['P'], description: '快捷快进' },
      { keys: ['↑', '↓'], description: '音量加 / 减' },
      { keys: ['F'], description: '全屏' },
    ],
  },
  {
    title: '选集',
    items: [
      { keys: ['Alt', '←'], description: '上一集' },
      { keys: ['Alt', '→'], description: '下一集' },
    ],
  },
  {
    title: '倍速',
    items: [
      { keys: ['小键盘 +'], description: '提高一档' },
      { keys: ['小键盘 -'], description: '降低一档' },
      { keys: ['小键盘 /'], description: '恢复 1x' },
    ],
  },
];

export interface KeyboardOptions {
  player: WatchPlayer;
  /** 播放器所在区域；为空表示整页都响应 */
  scope?: () => HTMLElement | null;
  /** 只在这个条件为真时响应（例如播放页可见） */
  active?: () => boolean;
  seekStep: () => number;
  quickForward: () => number;
  previous?: () => boolean;
  next?: () => boolean;
  /** false 时倍速快捷键只提示没有权限 */
  rateControl?: () => boolean;
  /** 没有播放权限时的提示（一起看） */
  locked?: () => string | null;
}

const EDITABLE =
  'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"]';

export function bindKeyboard(options: KeyboardOptions) {
  const handler = (event: KeyboardEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest(EDITABLE)) return;
    if (options.active && !options.active()) return;
    const scope = options.scope?.();
    if (scope && target && target !== document.body && !scope.contains(target))
      return;
    const art = options.player.art;
    if (!art) return;
    const done = () => event.preventDefault();
    const locked = options.locked?.() || null;

    if (event.altKey && event.key === 'ArrowLeft') {
      if (options.previous?.()) done();
      return;
    }
    if (event.altKey && event.key === 'ArrowRight') {
      if (options.next?.()) done();
      return;
    }
    if (event.altKey) return;

    switch (event.key) {
      case ' ':
        if (locked) art.notice.show = locked;
        else art.toggle();
        return done();
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (locked) {
          art.notice.show = locked;
          return done();
        }
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const seconds = options.seekStep();
        art.currentTime = calculateSeekTime(
          art.currentTime,
          art.duration,
          direction,
          seconds
        );
        art.notice.show = `${direction < 0 ? '快退' : '快进'} ${formatDuration(
          seconds
        )}`;
        return done();
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        const delta = event.key === 'ArrowUp' ? 0.1 : -0.1;
        art.volume = Math.min(
          1,
          Math.max(0, Math.round((art.volume + delta) * 10) / 10)
        );
        art.notice.show = `音量 ${Math.round(art.volume * 100)}`;
        return done();
      }
      case 'p':
      case 'P': {
        if (locked) {
          art.notice.show = locked;
          return done();
        }
        const seconds = options.quickForward();
        const duration = Number.isFinite(art.duration)
          ? art.duration
          : Infinity;
        art.currentTime = Math.min(duration, (art.currentTime || 0) + seconds);
        art.notice.show = `快进 ${formatDuration(seconds)}`;
        return done();
      }
      case 'f':
      case 'F':
        art.fullscreen = !art.fullscreen;
        return done();
    }

    if (['NumpadAdd', 'NumpadSubtract', 'NumpadDivide'].includes(event.code)) {
      if (options.rateControl && !options.rateControl()) {
        art.notice.show = locked || '没有调整倍速的权限';
        return done();
      }
      if (event.code === 'NumpadDivide') {
        art.playbackRate = 1;
        art.notice.show = '倍速：1x';
      } else
        stepPlaybackRate(
          art,
          PLAYBACK_RATES,
          event.code === 'NumpadAdd' ? 1 : -1
        );
      done();
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
