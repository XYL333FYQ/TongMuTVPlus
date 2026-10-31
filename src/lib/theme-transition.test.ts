import {
  changeThemeWithTransition,
  readSnapshotGeometry,
  resolveThemeMotion,
} from './theme-transition';

// 测试里用简化的假实现替换浏览器的视图过渡接口，类型放宽到测试需要的部分
const doc = document as unknown as {
  startViewTransition?: (
    update: () => void | Promise<void>
  ) => TMViewTransition;
};

let reduced = false;
let systemDark = false;
let motionChange: () => void = () => undefined;
const cancel = jest.fn();
const animate = jest.fn(
  (_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
    finished: Promise.resolve(),
    cancel,
  })
);
const origin = document.createElement('button');
const setTheme = jest.fn((theme: string) => {
  document.documentElement.className =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
});
beforeEach(() => {
  reduced = false;
  systemDark = false;
  motionChange = () => undefined;
  jest.clearAllMocks();
  Object.defineProperty(window, 'CSS', {
    configurable: true,
    value: undefined,
  });
  document.documentElement.className = 'dark';
  delete document.documentElement.dataset.tmReducedMotion;
  delete doc.startViewTransition;
  document.documentElement.style.setProperty(
    '--tm-ease-theme',
    'cubic-bezier(.22,1,.36,1)'
  );
  document.documentElement.style.setProperty('--tm-d-theme', '520ms');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn((query: string) => ({
      matches: query.includes('reduced-motion') ? reduced : systemDark,
      addEventListener: jest.fn((_event, listener) => {
        if (query.includes('reduced-motion')) motionChange = listener;
      }),
      removeEventListener: jest.fn(),
    })),
  });
  Object.defineProperty(document.documentElement, 'animate', {
    configurable: true,
    value: animate,
  });
  Object.defineProperty(document.body, 'animate', {
    configurable: true,
    value: animate,
  });
});

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

test('entering dark retracts the old light snapshot into the control', async () => {
  document.documentElement.className = 'light';
  let capturedOrigin: string | null = null;
  let capturedTarget: string | undefined;
  let capturedAura = false;
  doc.startViewTransition = (update) => {
    capturedOrigin = origin.getAttribute('data-tm-theme-origin');
    capturedTarget = document.documentElement.dataset.tmThemeTarget;
    capturedAura = Boolean(
      document.body.querySelector('[data-tm-theme-aura="true"]')
    );
    const completion = Promise.resolve(update());
    return {
      ready: completion,
      updateCallbackDone: completion,
      finished: completion,
      skipTransition: jest.fn(),
    };
  };
  await changeThemeWithTransition('dark', setTheme, origin);
  expect(capturedOrigin).toBe('true');
  expect(capturedTarget).toBe('dark');
  expect(capturedAura).toBe(true);
  const frames = animate.mock.calls[0][0];
  expect(frames[0].clipPath).not.toContain('circle(0px');
  expect(frames[1].clipPath).toContain('circle(0px');
  expect(animate.mock.calls[0][1]).toMatchObject({
    duration: 520,
    fill: 'forwards',
    easing: 'cubic-bezier(.22,1,.36,1)',
    pseudoElement: '::view-transition-old(root)',
  });
  expect(origin).not.toHaveAttribute('data-tm-theme-origin');
  expect(document.body.querySelector('[data-tm-theme-aura="true"]')).toBeNull();
  expect(document.documentElement.style.getPropertyValue('--tm-theme-x')).toBe(
    ''
  );
  expect(document.documentElement.dataset.tmThemeTarget).toBeUndefined();
});

test('same visual theme still saves system preference without replaying the page reveal', async () => {
  systemDark = true;
  const start = jest.fn();
  doc.startViewTransition = start;
  await changeThemeWithTransition('system', setTheme, origin);
  expect(setTheme).toHaveBeenCalledWith('system');
  expect(document.documentElement).toHaveClass('dark');
  expect(start).not.toHaveBeenCalled();
  expect(animate).not.toHaveBeenCalled();
});

test('fallback keeps the content visible throughout both fade phases', async () => {
  await changeThemeWithTransition('light', setTheme, origin);
  const opacities = animate.mock.calls.flatMap(([frames]) =>
    frames.map((frame) => Number(frame.opacity))
  );
  expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.8);
  expect(opacities[opacities.length - 1]).toBe(1);
});

test('an obsolete ready callback cannot remove the latest origin or overwrite its choice', async () => {
  const first = deferred();
  const second = deferred();
  const waits = [first, second];
  const skip = jest.fn();
  doc.startViewTransition = (update) => {
    const wait = waits.shift();
    if (!wait) throw new Error('unexpected extra transition');
    const completion = Promise.resolve(update());
    return {
      ready: wait.promise,
      updateCallbackDone: completion,
      finished: completion,
      skipTransition: skip,
    };
  };
  const nextOrigin = document.createElement('button');
  const firstRequest = changeThemeWithTransition('light', setTheme, origin);
  const secondRequest = changeThemeWithTransition('dark', setTheme, nextOrigin);
  first.resolve();
  await firstRequest;
  expect(document.documentElement).toHaveClass('dark');
  expect(document.documentElement.dataset.tmThemeTransition).toBe('circle');
  expect(origin).not.toHaveAttribute('data-tm-theme-origin');
  expect(nextOrigin).toHaveAttribute('data-tm-theme-origin', 'true');
  second.resolve();
  await secondRequest;
  expect(animate).toHaveBeenCalledTimes(1);
  expect(skip).toHaveBeenCalled();
  expect(nextOrigin).not.toHaveAttribute('data-tm-theme-origin');
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});

test('enabling reduced motion while waiting cancels the reveal and clears its control layer', async () => {
  const ready = deferred();
  const skip = jest.fn();
  doc.startViewTransition = (update) => {
    const completion = Promise.resolve(update());
    return {
      ready: ready.promise,
      updateCallbackDone: completion,
      finished: completion,
      skipTransition: skip,
    };
  };
  const pending = changeThemeWithTransition('light', setTheme, origin);
  reduced = true;
  motionChange();
  ready.resolve();
  await pending;
  expect(document.documentElement).toHaveClass('light');
  expect(skip).toHaveBeenCalled();
  expect(animate).not.toHaveBeenCalled();
  expect(origin).not.toHaveAttribute('data-tm-theme-origin');
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});
afterEach(() => {
  delete doc.startViewTransition;
  delete document.documentElement.dataset.tmReducedMotion;
});
test.each(['site', 'system'])(
  '%s reduced motion applies the choice without circle or fade',
  async (setting) => {
    if (setting === 'site')
      document.documentElement.dataset.tmReducedMotion = 'true';
    else reduced = true;
    await changeThemeWithTransition('light', setTheme, origin);
    expect(document.documentElement).toHaveClass('light');
    expect(animate).not.toHaveBeenCalled();
  }
);
test('unsupported View Transitions fades out and in for 250ms total', async () => {
  await changeThemeWithTransition('light', setTheme, origin);
  expect(document.documentElement).toHaveClass('light');
  expect(animate).toHaveBeenCalledTimes(2);
  expect(animate.mock.calls[0][1]).toMatchObject({ duration: 125 });
  expect(animate.mock.calls[1][1]).toMatchObject({ duration: 125 });
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});
test('circle waits for the next-themes class update and uses the control centre', async () => {
  origin.getBoundingClientRect = () =>
    ({ left: 20, top: 30, width: 44, height: 44 } as DOMRect);
  let updateDone = false;
  doc.startViewTransition = (update) => {
    const completion = Promise.resolve(update()).then(() => {
      updateDone = true;
    });
    return {
      ready: completion,
      updateCallbackDone: completion,
      finished: completion,
      skipTransition: jest.fn(),
    };
  };
  const select = jest.fn();
  const pending = changeThemeWithTransition('light', select, origin);
  await Promise.resolve();
  expect(select).toHaveBeenCalledWith('light');
  expect(updateDone).toBe(false);
  expect(animate).not.toHaveBeenCalled();
  document.documentElement.className = 'light';
  await pending;
  expect(animate.mock.calls[0][0][0]).toEqual({
    clipPath: 'circle(0px at 42px 52px)',
  });
  expect(animate.mock.calls[0][1]).toMatchObject({
    duration: 520,
    easing: 'cubic-bezier(.22,1,.36,1)',
    pseudoElement: '::view-transition-new(root)',
  });
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});
test('a failed snapshot still applies the theme and cleans up', async () => {
  const failure = Promise.reject(new Error('snapshot unavailable'));
  doc.startViewTransition = () => ({
    ready: failure,
    updateCallbackDone: failure,
    finished: failure,
    skipTransition: jest.fn(),
  });
  await changeThemeWithTransition('light', setTheme, origin);
  expect(document.documentElement).toHaveClass('light');
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});

function startSuccessfulTransition(update: () => void | Promise<void>) {
  const completion = Promise.resolve(update());
  return {
    ready: completion,
    updateCallbackDone: completion,
    finished: completion,
    skipTransition: jest.fn(),
  };
}

test.each(['light', 'dark'] as const)(
  '%s crisp circular clip-path uses the control centre and covers every corner before cleanup',
  async (theme) => {
    doc.startViewTransition = startSuccessfulTransition;
    document.documentElement.className = theme === 'light' ? 'dark' : 'light';
    origin.getBoundingClientRect = () =>
      ({ left: 20, top: 30, width: 44, height: 44 } as DOMRect);
    await changeThemeWithTransition(theme, setTheme, origin);
    expect(animate).toHaveBeenCalledTimes(1);
    const frames = animate.mock.calls[0][0];
    const farthest = Math.hypot(
      Math.max(42, window.innerWidth - 42),
      Math.max(52, window.innerHeight - 52)
    );
    const zeroClip = 'circle(0px at 42px 52px)';
    const fullClip = `circle(${farthest}px at 42px 52px)`;
    expect(frames).toEqual(
      theme === 'light'
        ? [{ clipPath: zeroClip }, { clipPath: fullClip }]
        : [{ clipPath: fullClip }, { clipPath: zeroClip }]
    );
    expect(animate.mock.calls[0][1]).toMatchObject({
      duration: 520,
      fill: 'forwards',
      easing: 'cubic-bezier(.22,1,.36,1)',
      pseudoElement:
        theme === 'light'
          ? '::view-transition-new(root)'
          : '::view-transition-old(root)',
    });
  }
);

test('reduced motion cancels the active circular clip-path animation', async () => {
  doc.startViewTransition = startSuccessfulTransition;
  const first = deferred();
  const started = deferred();
  const cancelFirst = jest.fn(first.resolve);
  animate.mockImplementationOnce(() => {
    started.resolve();
    return {
      finished: first.promise,
      cancel: cancelFirst,
    };
  });
  const pending = changeThemeWithTransition('light', setTheme, origin);
  await started.promise;
  reduced = true;
  motionChange();
  await pending;
  expect(cancelFirst).toHaveBeenCalled();
  expect(document.documentElement).toHaveClass('light');
  expect(origin).not.toHaveAttribute('data-tm-theme-origin');
});

describe('readSnapshotGeometry：圆心取浏览器给出的真实位置', () => {
  const style = (transform: string, width = '', height = '') => ({
    transform,
    width,
    height,
  });
  const fallback = { x: 100, y: 50, width: 390, height: 800 };
  const make =
    (table: Record<string, ReturnType<typeof style>>) =>
    (_el: Element, pseudo: string) =>
      table[pseudo] || style('none');

  test('读到过渡层坐标：根画面比页面靠上 56px（手机地址栏）时，圆心跟着按钮', () => {
    const geo = readSnapshotGeometry(
      document.documentElement,
      fallback,
      make({
        '::view-transition': style('none', '390px', '856px'),
        '::view-transition-group(root)': style(
          'matrix(1, 0, 0, 1, 0, 56)',
          '390px',
          '856px'
        ),
        // 按钮在过渡层里的位置 = 页面位置 + 56（过渡层从地址栏下面开始算）
        '::view-transition-group(tm-theme-control)': style(
          'matrix(1, 0, 0, 1, 80, 106)',
          '44px',
          '44px'
        ),
      })
    );
    expect(geo.x).toBe(102);
    expect(geo.y).toBe(128);
    // 根画面自己的坐标系要扣掉它的平移
    expect(geo.localX).toBe(102);
    expect(geo.localY).toBe(72);
    expect(geo.width).toBe(390);
    expect(geo.height).toBe(856);
    expect(geo.radius).toBeGreaterThan(Math.hypot(390 - 102, 856 - 72) - 1);
  });

  test('没有平移时圆心等于控件中心，半径够到最远的角', () => {
    const geo = readSnapshotGeometry(
      document.documentElement,
      fallback,
      make({
        '::view-transition': style('none', '400px', '800px'),
        '::view-transition-group(root)': style('none', '400px', '800px'),
        '::view-transition-group(tm-theme-control)': style(
          'matrix(1, 0, 0, 1, 10, 20)',
          '40px',
          '40px'
        ),
      })
    );
    expect([geo.x, geo.y]).toEqual([30, 40]);
    expect(geo.radius).toBeCloseTo(Math.hypot(370, 760) + 2, 5);
  });

  test('读不到有效尺寸、或读取时抛错，就退回页面坐标', () => {
    expect(
      readSnapshotGeometry(document.documentElement, fallback, make({}))
    ).toMatchObject({ x: 100, y: 50, localX: 100, localY: 50 });
    expect(
      readSnapshotGeometry(document.documentElement, fallback, () => {
        throw new Error('不支持读伪元素');
      })
    ).toMatchObject({ x: 100, y: 50, width: 390, height: 800 });
  });
});

describe('圆形过渡的收拢 / 铺开：App 里两个方向都铺开（扩散）', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-tm-platform');
  });

  test('resolveThemeMotion：网页保持进深色收拢、进浅色铺开，App 全部铺开', () => {
    expect(resolveThemeMotion(true, 'web')).toBe('converge');
    expect(resolveThemeMotion(false, 'web')).toBe('spread');
    expect(resolveThemeMotion(true, 'desktop')).toBe('converge');
    expect(resolveThemeMotion(false, 'desktop')).toBe('spread');
    expect(resolveThemeMotion(true, 'app')).toBe('spread');
    expect(resolveThemeMotion(false, 'app')).toBe('spread');
  });

  test('App 里进深色：新画面在上层被圆从按钮撑开（扩散），而不是旧画面收回', async () => {
    document.documentElement.setAttribute('data-tm-platform', 'app');
    document.documentElement.className = 'light';
    let motionAtStart: string | undefined;
    doc.startViewTransition = (update) => {
      motionAtStart = document.documentElement.dataset.tmThemeMotion;
      return startSuccessfulTransition(update);
    };
    origin.getBoundingClientRect = () =>
      ({ left: 20, top: 30, width: 44, height: 44 } as DOMRect);
    await changeThemeWithTransition('dark', setTheme, origin);
    expect(motionAtStart).toBe('spread');
    const frames = animate.mock.calls[0][0];
    expect(frames[0].clipPath).toContain('circle(0px at 42px 52px)');
    expect(frames[1].clipPath).not.toContain('circle(0px');
    expect(animate.mock.calls[0][1]).toMatchObject({
      pseudoElement: '::view-transition-new(root)',
    });
    expect(document.documentElement.dataset.tmThemeMotion).toBeUndefined();
  });

  test('网页里进浅色仍是新画面被圆撑开', async () => {
    document.documentElement.className = 'dark';
    let motionAtStart: string | undefined;
    doc.startViewTransition = (update) => {
      motionAtStart = document.documentElement.dataset.tmThemeMotion;
      return startSuccessfulTransition(update);
    };
    await changeThemeWithTransition('light', setTheme, origin);
    expect(motionAtStart).toBe('spread');
    expect(animate.mock.calls[0][1]).toMatchObject({
      pseudoElement: '::view-transition-new(root)',
    });
  });
});
