import { DEVICE_TIER_ATTRIBUTE } from './device-tier';
import { installTouchControls } from './player-touch-controls';

function fakeArt() {
  const player = document.createElement('div');
  document.body.appendChild(player);
  const handlers = new Map<string, Array<() => void>>();
  const art = {
    currentTime: 100,
    duration: 1000,
    playing: true,
    fullscreen: false,
    fullscreenWeb: false,
    notice: { show: '' },
    template: { $player: player },
    layers: {
      add(option: { html: string }) {
        const layer = document.createElement('div');
        layer.className = 'art-layer-tm-touch';
        layer.innerHTML = option.html;
        player.appendChild(layer);
        return layer;
      },
    },
    on(name: string, handler: () => void) {
      handlers.set(name, [...(handlers.get(name) || []), handler]);
    },
    off: jest.fn(),
    toggle: jest.fn(),
  };
  const emit = (name: string) => handlers.get(name)?.forEach((fn) => fn());
  return { art, player, emit };
}

function setDevice(tier: string, coarse: boolean) {
  document.documentElement.setAttribute(DEVICE_TIER_ATTRIBUTE, tier);
  window.matchMedia = ((query: string) => ({
    matches: query.includes('coarse') ? coarse : false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as never;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(DEVICE_TIER_ATTRIBUTE);
});

test('phones get the centre group; the seek buttons move by the configured step', () => {
  setDevice('phone', true);
  const { art, player } = fakeArt();
  installTouchControls(art, {
    stepSeconds: () => 10,
    exitFullscreen: jest.fn(),
  });
  const cluster = player.querySelector('.tm-touch') as HTMLElement;
  expect(cluster.hidden).toBe(false);
  expect(player).toHaveAttribute('data-tm-touch');
  (player.querySelector('[data-act="forward"]') as HTMLElement).click();
  expect(art.currentTime).toBe(110);
  expect(art.notice.show).toBe('快进 10 秒');
  (player.querySelector('[data-act="back"]') as HTMLElement).click();
  expect(art.currentTime).toBe(100);
});

test('desktops with a mouse do not get it', () => {
  setDevice('wide', false);
  const { art, player } = fakeArt();
  installTouchControls(art, {
    stepSeconds: () => 10,
    exitFullscreen: jest.fn(),
  });
  expect((player.querySelector('.tm-touch') as HTMLElement).hidden).toBe(true);
});

test('it hides with the control bar and when the screen is locked', () => {
  setDevice('phone', true);
  const { art, player, emit } = fakeArt();
  installTouchControls(art, {
    stepSeconds: () => 10,
    exitFullscreen: jest.fn(),
  });
  const cluster = player.querySelector('.tm-touch') as HTMLElement;
  player.classList.add('art-hide-cursor');
  emit('pause');
  expect(cluster.hidden).toBe(true);
  player.classList.remove('art-hide-cursor');
  player.classList.add('art-lock');
  emit('pause');
  expect(cluster.hidden).toBe(true);
});

test('in phone fullscreen there is a way out at the top left', () => {
  setDevice('phone-landscape', true);
  const exitFullscreen = jest.fn();
  const { art, player, emit } = fakeArt();
  installTouchControls(art, { stepSeconds: () => 10, exitFullscreen });
  const exit = player.querySelector('.tm-touch-exit') as HTMLButtonElement;
  expect(exit.hidden).toBe(true);
  art.fullscreen = true;
  emit('fullscreen');
  expect(exit.hidden).toBe(false);
  exit.click();
  expect(exitFullscreen).toHaveBeenCalled();
});
