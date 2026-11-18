import {
  computeDeviceTier,
  DEVICE_TIER_ATTRIBUTE,
  DEVICE_TIER_BOOT_SCRIPT,
  getDeviceTier,
  pageLayoutFor,
  settleLayoutHeight,
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

test('opening the on-screen keyboard does not change the tier', () => {
  document.documentElement.removeAttribute(DEVICE_TIER_ATTRIBUTE);
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      callback(0);
      // 同步调用时 rAF 的返回值会在回调之后才赋给 frame，返回 0 才不会卡住后续的 resize
      return 0;
    });
  const matchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('coarse'),
  })) as never;
  // 平板横屏
  Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
  // eslint-disable-next-line no-new-func
  new Function(DEVICE_TIER_BOOT_SCRIPT)();
  expect(getDeviceTier()).toBe('wide');
  // 点聊天输入框，App 壳把窗口压矮到 420：仍是平板横屏，不换成横屏手机
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  Object.assign(window, { innerHeight: 420 });
  window.dispatchEvent(new Event('resize'));
  expect(getDeviceTier()).toBe('wide');
  // 收起键盘、离开输入框以后，真的转成竖屏照样换档
  input.blur();
  Object.assign(window, { innerWidth: 800, innerHeight: 1280 });
  window.dispatchEvent(new Event('resize'));
  expect(getDeviceTier()).toBe('tablet');
  input.remove();
  window.matchMedia = matchMedia;
  raf.mockRestore();
});

test('a shorter window without typing still changes the tier', () => {
  const memory = { width: 1280, height: 800 };
  expect(settleLayoutHeight(memory, 1280, 420, false)).toBe(420);
  // 输入时变矮：沿用之前的高度；变高照常记下
  expect(settleLayoutHeight(memory, 1280, 300, true)).toBe(420);
  expect(settleLayoutHeight(memory, 1280, 500, true)).toBe(500);
  expect(settleLayoutHeight(memory, 1280, 200, true)).toBe(500);
  // 宽度变了（转屏、拖窗口）就不再沿用
  expect(settleLayoutHeight(memory, 900, 200, true)).toBe(200);
});

describe('pageLayoutFor：电脑、平板、手机各一套', () => {
  test.each([
    ['phone', true, 'compact'],
    ['phone-landscape', true, 'compact'],
    // 平板横竖都是平板排版，不照搬电脑
    ['wide', true, 'tablet'],
    ['tablet', true, 'tablet'],
    // 鼠标操作的大屏是电脑；竖长的电脑窗口按紧凑排
    ['wide', false, 'desktop'],
    ['tablet', false, 'compact'],
  ] as const)('%s coarse=%s → %s', (tier, coarse, layout) => {
    expect(pageLayoutFor(tier, coarse)).toBe(layout);
  });
});
