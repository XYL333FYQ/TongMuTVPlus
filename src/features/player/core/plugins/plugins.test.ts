/* eslint-disable @typescript-eslint/no-explicit-any */
import { playbackRatePlugin } from './basics';
import { heatmapPlugin, setHeatmapEnabled } from './heatmap';

jest.mock('../env', () => ({
  playerEnvironment: () => ({ webkit: true, ios: false }),
}));

/** 只有插件用到的那几样：事件、控件、模板、video */
function fakeArt() {
  const handlers = new Map<string, Array<(...args: any[]) => void>>();
  const player = document.createElement('div');
  const progress = document.createElement('div');
  progress.className = 'art-control-progress';
  player.appendChild(progress);
  const video = document.createElement('video');
  const art: any = {
    duration: 100,
    currentTime: 0,
    playbackRate: 1,
    video,
    template: { $player: player },
    controls: {
      add(control: any) {
        const el = document.createElement('div');
        el.innerHTML = control.html;
        Object.assign(el.style, control.style);
        player.appendChild(el);
        control.mounted?.(el);
      },
    },
    on(event: string, handler: (...args: any[]) => void) {
      handlers.set(event, [...(handlers.get(event) || []), handler]);
    },
    emit(event: string, ...args: any[]) {
      (handlers.get(event) || []).forEach((handler) => handler(...args));
    },
  };
  return art;
}

/** later 直接记下，测试里手动执行 */
function laterQueue() {
  const queue: Array<{ fn: () => void; ms: number }> = [];
  return {
    later: (fn: () => void, ms: number) => queue.push({ fn, ms }),
    run(ms?: number) {
      const due = queue.filter((item) => ms === undefined || item.ms === ms);
      due.forEach((item) => queue.splice(queue.indexOf(item), 1));
      due.forEach((item) => item.fn());
    },
  };
}

describe('heatmap', () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom 没有 canvas：只验证显示 / 隐藏
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  test('shows once danmaku arrive and follows the setting switch', () => {
    const art = fakeArt();
    const timers = laterQueue();
    let list: Array<{ time: number }> = [];
    heatmapPlugin(() => list)({ art, player: {} as any, later: timers.later });
    const host = art.template.$player.querySelector('.tm-heatmap-canvas')
      .parentElement as HTMLElement;
    expect(host.style.display).toBe('none');

    list = [{ time: 1 }, { time: 2 }, { time: 50 }];
    art.emit('danmaku:loaded');
    expect(host.style.display).toBe('block');

    setHeatmapEnabled(art, false);
    expect(localStorage.getItem('danmaku_heatmap_enabled')).toBe('false');
    expect(host.style.display).toBe('none');

    setHeatmapEnabled(art, true);
    expect(host.style.display).toBe('block');
  });
});

describe('playback rate memory', () => {
  beforeEach(() => localStorage.setItem('preferredPlaybackRate', '2'));

  test('Safari: waits for the seek to finish before restoring the rate', () => {
    const art = fakeArt();
    const timers = laterQueue();
    playbackRatePlugin()({ art, player: {} as any, later: timers.later });
    Object.defineProperty(art.video, 'seeking', {
      configurable: true,
      value: true,
    });
    art.emit('video:canplay');
    timers.run(0);
    expect(art.playbackRate).toBe(1);

    art.video.dispatchEvent(new Event('seeked'));
    expect(art.playbackRate).toBe(2);
  });

  test('restores right away when not seeking', () => {
    const art = fakeArt();
    const timers = laterQueue();
    playbackRatePlugin()({ art, player: {} as any, later: timers.later });
    art.emit('video:canplay');
    timers.run(0);
    expect(art.playbackRate).toBe(2);
  });
});
