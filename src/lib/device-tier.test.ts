import {
  computeDeviceTier,
  DEVICE_TIER_ATTRIBUTE,
  DEVICE_TIER_BOOT_SCRIPT,
  getDeviceTier,
} from './device-tier';

describe('computeDeviceTier', () => {
  test.each([
    // 手机竖屏
    [390, 844, true, 'phone'],
    [360, 780, true, 'phone'],
    // 手机横屏（包括宽度超过 768 的大手机）
    [844, 390, true, 'phone-landscape'],
    [932, 430, true, 'phone-landscape'],
    [568, 320, true, 'phone-landscape'],
    // 平板竖屏
    [820, 1180, true, 'tablet'],
    [768, 1024, true, 'tablet'],
    [600, 960, true, 'tablet'],
    // 平板横屏和电脑同一档（问题文档里的平板横屏截图约 845×553）
    [1180, 820, true, 'wide'],
    [845, 553, true, 'wide'],
    [1024, 768, true, 'wide'],
    [1280, 720, false, 'wide'],
    // 电脑客户端最小窗口 800×500：鼠标设备不算横屏手机
    [800, 500, false, 'wide'],
    // 很窄的电脑窗口按手机排
    [500, 900, false, 'phone'],
  ])('%i×%i coarse=%s → %s', (width, height, coarse, tier) => {
    expect(computeDeviceTier(width, height, coarse as boolean)).toBe(tier);
  });
});

test('the boot script writes the tier and updates it on resize', () => {
  document.documentElement.removeAttribute(DEVICE_TIER_ATTRIBUTE);
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  Object.assign(window, { innerWidth: 390, innerHeight: 844 });
  // eslint-disable-next-line no-new-func
  new Function(DEVICE_TIER_BOOT_SCRIPT)();
  expect(document.documentElement.getAttribute(DEVICE_TIER_ATTRIBUTE)).toBe(
    'phone'
  );
  const events: string[] = [];
  window.addEventListener('tm-device-tier', (event) =>
    events.push((event as CustomEvent).detail)
  );
  Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
  window.dispatchEvent(new Event('resize'));
  expect(getDeviceTier()).toBe('wide');
  expect(events).toEqual(['wide']);
  raf.mockRestore();
});
