import { enableArtKeyboardAccess } from './art-keyboard';

function buildPlayer() {
  document.body.innerHTML = `
    <div class="art-bottom">
      <div class="art-control art-control-progress"></div>
      <div class="art-control art-control-time">00:00</div>
      <div class="art-control art-control-thumbnails"></div>
      <div class="art-control art-control-playAndPause"></div>
      <div class="art-control art-control-setting" aria-label="设置"></div>
      <div class="art-control art-control-screenshot" aria-label="截图"></div>
    </div>
    <div class="art-settings"></div>`;
  return {
    bottom: document.querySelector<HTMLElement>('.art-bottom')!,
    settings: document.querySelector<HTMLElement>('.art-settings')!,
  };
}

test('toolbar buttons become tabbable buttons, display-only parts do not', () => {
  const { bottom, settings } = buildPlayer();
  const cleanup = enableArtKeyboardAccess([bottom, settings]);

  const setting = bottom.querySelector<HTMLElement>('.art-control-setting')!;
  expect(setting.tabIndex).toBe(0);
  expect(setting.getAttribute('role')).toBe('button');
  expect(
    bottom.querySelector('.art-control-progress')!.hasAttribute('tabindex')
  ).toBe(false);
  expect(
    bottom.querySelector('.art-control-time')!.hasAttribute('tabindex')
  ).toBe(false);
  expect(
    bottom.querySelector('.art-control-thumbnails')!.hasAttribute('tabindex')
  ).toBe(false);
  expect(
    bottom
      .querySelector('.art-control-playAndPause')!
      .getAttribute('aria-label')
  ).toBe('播放或暂停');
  expect(setting.getAttribute('aria-label')).toBe('设置');
  cleanup();
});

test('Enter and Space click the focused control and do not reach the player hotkeys', () => {
  const { bottom, settings } = buildPlayer();
  const cleanup = enableArtKeyboardAccess([bottom, settings]);
  const shot = bottom.querySelector<HTMLElement>('.art-control-screenshot')!;
  const clicks = jest.fn();
  shot.addEventListener('click', clicks);
  const hotkeys = jest.fn();
  document.addEventListener('keydown', hotkeys);

  shot.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
  shot.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  shot.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

  expect(clicks).toHaveBeenCalledTimes(2);
  expect(hotkeys).toHaveBeenCalledTimes(1);
  document.removeEventListener('keydown', hotkeys);
  cleanup();
});

test('settings items added later become reachable too', async () => {
  const { bottom, settings } = buildPlayer();
  const cleanup = enableArtKeyboardAccess([bottom, settings]);
  const item = document.createElement('div');
  item.className = 'art-setting-item';
  settings.appendChild(item);
  await Promise.resolve();
  expect(item.tabIndex).toBe(0);
  expect(item.getAttribute('role')).toBe('button');
  cleanup();
});

test('Escape inside the settings panel closes it and returns focus to the settings button', () => {
  const { bottom, settings } = buildPlayer();
  settings.className = 'art-settings';
  const item = document.createElement('div');
  item.className = 'art-setting-item';
  settings.appendChild(item);
  const cleanup = enableArtKeyboardAccess([bottom, settings]);
  const toggle = bottom.querySelector<HTMLElement>('.art-control-setting')!;
  const toggled = jest.fn();
  toggle.addEventListener('click', toggled);

  item.focus();
  item.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  expect(toggled).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(toggle);
  cleanup();
});
