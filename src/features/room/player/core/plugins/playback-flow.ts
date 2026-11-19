/*
 * 播放流程类插件：跳过片头片尾、续播提示、自动下一集、播放进度保存、下一集预加载。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { formatClock } from './format';
import type { PlayerPlugin } from '../WatchPlayer';

export interface SkipConfig {
  enable: boolean;
  /** 片头秒数，0 表示不跳 */
  intro_time: number;
  /** 片尾：负数，表示距结尾多少秒 */
  outro_time: number;
}

/** 到片头时间前自动跳过；到片尾时间后进入下一集（或暂停） */
export function skipIntroPlugin(options: {
  config: () => SkipConfig;
  onOutro: () => void;
}): PlayerPlugin {
  return ({ art }) => {
    let lastCheck = 0;
    let outroFired = false;
    art.on('video:canplay', () => {
      outroFired = false;
    });
    art.on('video:timeupdate', () => {
      const config = options.config();
      if (!config.enable) return;
      const now = Date.now();
      if (now - lastCheck < 1500) return;
      lastCheck = now;
      const time = art.currentTime || 0;
      const duration = art.duration || 0;
      if (config.intro_time > 0 && time < config.intro_time) {
        art.currentTime = config.intro_time;
        art.notice.show = `已跳过片头（${formatClock(config.intro_time)}）`;
      }
      if (
        !outroFired &&
        config.outro_time < 0 &&
        duration > 0 &&
        time > duration + config.outro_time
      ) {
        outroFired = true;
        art.notice.show = `已跳过片尾（${formatClock(-config.outro_time)}）`;
        options.onOutro();
      }
    });
  };
}

/** 播完自动下一集 */
export function autoNextPlugin(onEnded: () => void): PlayerPlugin {
  return ({ art }) => {
    art.on('video:ended', onEnded);
  };
}

/** 每隔几秒保存一次进度；暂停、离开时也保存 */
export function progressSavePlugin(
  save: () => void,
  intervalMs: number
): PlayerPlugin {
  return ({ art }) => {
    let last = 0;
    art.on('video:timeupdate', () => {
      const now = Date.now();
      if (now - last > intervalMs) {
        last = now;
        save();
      }
    });
    art.on('pause', save);
    return save;
  };
}

/**
 * 续播提示：开头 10 秒内发现本集有更晚的观看记录，就在左下角提示“上次看到 xx”。
 * lookup 返回记录的时间点，没有记录返回 null。
 */
export function resumePromptPlugin(options: {
  lookup: () => Promise<number | null>;
  /** 本集已经在别处恢复过进度（或者用户主动切集）时不再提示 */
  suppressed: () => boolean;
}): PlayerPlugin {
  return ({ art, later }) => {
    let checked = false;
    let layer: HTMLElement | null = null;
    const remove = () => {
      if (!layer) return;
      try {
        art.layers.remove('tm-resume');
      } catch {
        // 忽略
      }
      layer = null;
    };
    art.on('video:canplay', () => {
      checked = false;
      remove();
    });
    art.on('video:timeupdate', () => {
      if (layer && (art.currentTime || 0) >= 15) remove();
    });
    art.on('video:playing', () =>
      later(async () => {
        if (checked || options.suppressed()) return;
        checked = true;
        const current = art.currentTime || 0;
        if (current >= 10) return;
        const recorded = await options.lookup().catch(() => null);
        if (!recorded || recorded <= 10 || (art.currentTime || 0) >= 10) return;
        if (!art.layers) return;
        art.layers.add({
          name: 'tm-resume',
          html: `<div class="tm-resume-prompt" role="status">
              <span>上次看到 ${formatClock(recorded)}</span>
              <button type="button" data-act="jump">继续看</button>
              <button type="button" data-act="close" aria-label="关闭">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>`,
          style: {
            position: 'absolute',
            left: '0',
            bottom: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          },
        });
        layer = art.layers['tm-resume'] as HTMLElement;
        layer
          ?.querySelector<HTMLButtonElement>('[data-act="jump"]')
          ?.addEventListener('click', (event) => {
            event.stopPropagation();
            art.currentTime = recorded;
            art.notice.show = `已跳到 ${formatClock(recorded)}`;
            remove();
          });
        layer
          ?.querySelector<HTMLButtonElement>('[data-act="close"]')
          ?.addEventListener('click', (event) => {
            event.stopPropagation();
            remove();
          });
      }, 500)
    );
    return remove;
  };
}

/**
 * 看到 90% 时预加载：下一集的前 20 个分片（设置里开启“预缓存下一集”时）
 * 以及下一集弹幕（开启“预加载下一集弹幕”时）。
 */
export function preloadNextPlugin(options: {
  nextUrl: () => string | null;
  preloadDanmaku: () => void;
}): PlayerPlugin {
  return ({ art }) => {
    let videoDone = false;
    let danmakuDone = false;
    art.on('video:canplay', () => {
      videoDone = false;
      danmakuDone = false;
    });
    art.on('video:timeupdate', () => {
      const duration = art.duration || 0;
      if (!duration || (art.currentTime || 0) / duration < 0.9) return;
      if (!videoDone && readFlag('nextEpisodePreCache')) {
        videoDone = true;
        const url = options.nextUrl();
        if (url && url.includes('m3u8')) void preloadSegments(url);
      }
      if (!danmakuDone && readFlag('nextEpisodeDanmakuPreload')) {
        danmakuDone = true;
        options.preloadDanmaku();
      }
    });
  };
}

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

async function preloadSegments(url: string) {
  try {
    const text = await (await fetch(url)).text();
    const base = url.substring(0, url.lastIndexOf('/') + 1);
    const segments = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .slice(0, 20)
      .map((line) => (line.startsWith('http') ? line : base + line));
    for (const segment of segments) await fetch(segment).catch(() => undefined);
  } catch {
    // 预加载失败不影响播放
  }
}
