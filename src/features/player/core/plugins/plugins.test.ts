import { playbackRatePlugin } from './basics';
import { DanmakuController } from './danmaku';
import { heatmapPlugin, setHeatmapEnabled } from './heatmap';
import type { Art } from '../art-types';
import type { PluginContext, WatchPlayer } from '../WatchPlayer';

jest.mock('../env', () => ({
  playerEnvironment: () => ({ webkit: true, ios: false }),
}));

type Handler = (...args: unknown[]) => void;
interface FakeControl {
  html: string;
  style?: Partial<CSSStyleDeclaration>;
  mounted?: (el: HTMLElement) => void;
}

/** 只有插件用到的那几样：事件、控件、模板、video */
function fakeArt() {
  const handlers = new Map<string, Handler[]>();
  const player = document.createElement('div');
  const progress = document.createElement('div');
  progress.className = 'art-control-progress';
  player.appendChild(progress);
  const video = document.createElement('video');
  const art = {
    duration: 100,
    currentTime: 0,
    playbackRate: 1,
    video,
    template: { $player: player },
    controls: {
      add(control: FakeControl) {
        const el = document.createElement('div');
        el.innerHTML = control.html;
        Object.assign(el.style, control.style);
        player.appendChild(el);
        control.mounted?.(el);
      },
    },
    storage: undefined as undefined | { get: () => null; set: () => undefined },
    on(event: string, handler: Handler) {
      handlers.set(event, [...(handlers.get(event) || []), handler]);
    },
    emit(event: string, ...args: unknown[]) {
      (handlers.get(event) || []).forEach((handler) => handler(...args));
    },
  };
  return art;
}

/** 假播放器只实现了插件用到的部分，交给插件时当成 Art */
const asArt = (art: ReturnType<typeof fakeArt>) => art as unknown as Art;
const pluginContext = (
  art: ReturnType<typeof fakeArt>,
  later: PluginContext['later']
): PluginContext => ({ art: asArt(art), player: {} as WatchPlayer, later });

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
    heatmapPlugin(() => list)(pluginContext(art, timers.later));
    const host = art.template.$player.querySelector('.tm-heatmap-canvas')
      ?.parentElement as HTMLElement;
    expect(host.style.display).toBe('none');

    list = [{ time: 1 }, { time: 2 }, { time: 50 }];
    art.emit('danmaku:loaded');
    expect(host.style.display).toBe('block');

    setHeatmapEnabled(asArt(art), false);
    expect(localStorage.getItem('danmaku_heatmap_enabled')).toBe('false');
    expect(host.style.display).toBe('none');

    setHeatmapEnabled(asArt(art), true);
    expect(host.style.display).toBe('block');
  });
});

describe('playback rate memory', () => {
  beforeEach(() => localStorage.setItem('preferredPlaybackRate', '2'));

  test('Safari: waits for the seek to finish before restoring the rate', () => {
    const art = fakeArt();
    const timers = laterQueue();
    playbackRatePlugin()(pluginContext(art, timers.later));
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
    playbackRatePlugin()(pluginContext(art, timers.later));
    art.emit('video:canplay');
    timers.run(0);
    expect(art.playbackRate).toBe(2);
  });
});

describe('danmaku display state', () => {
  beforeEach(() => localStorage.clear());

  test('the hide fired while the player is destroyed is not saved', () => {
    const art = fakeArt();
    art.storage = { get: () => null, set: () => undefined };
    const controller = new DanmakuController(() => undefined);
    const dispose = controller.attach(asArt(art));
    art.emit('ready');
    art.emit('artplayerPluginDanmuku:hide');
    expect(localStorage.getItem('danmaku_display_enabled')).toBe('false');
    art.emit('artplayerPluginDanmuku:show');
    dispose();
    art.emit('artplayerPluginDanmuku:hide');
    expect(localStorage.getItem('danmaku_display_enabled')).toBe('true');
  });
});
