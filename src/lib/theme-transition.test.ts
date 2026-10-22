import { changeThemeWithTransition } from './theme-transition';

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
  delete document.startViewTransition;
  document.documentElement.style.setProperty(
    '--tm-ease-out',
    'cubic-bezier(.22,1,.36,1)'
  );
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
  document.startViewTransition = (update) => {
    capturedOrigin = origin.getAttribute('data-tm-theme-origin');
    capturedTarget = document.documentElement.dataset.tmThemeTarget;
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
  const frames = animate.mock.calls[0][0];
  expect(frames[0].clipPath).not.toContain('circle(0px');
  expect(frames[1].clipPath).toContain('circle(0px');
  expect(animate.mock.calls[0][1]).toMatchObject({
    duration: 500,
    fill: 'forwards',
    pseudoElement: '::view-transition-old(root)',
  });
  expect(origin).not.toHaveAttribute('data-tm-theme-origin');
  expect(document.documentElement.dataset.tmThemeTarget).toBeUndefined();
});

test('same visual theme still saves system preference without replaying the page reveal', async () => {
  systemDark = true;
  const start = jest.fn();
  document.startViewTransition = start;
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
  document.startViewTransition = (update) => {
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
  document.startViewTransition = (update) => {
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
  delete document.startViewTransition;
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
  document.startViewTransition = (update) => {
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
    duration: 500,
    pseudoElement: '::view-transition-new(root)',
  });
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});
test('a failed snapshot still applies the theme and cleans up', async () => {
  const failure = Promise.reject(new Error('snapshot unavailable'));
  document.startViewTransition = () => ({
    ready: failure,
    updateCallbackDone: failure,
    finished: failure,
    skipTransition: jest.fn(),
  });
  await changeThemeWithTransition('light', setTheme, origin);
  expect(document.documentElement).toHaveClass('light');
  expect(document.documentElement.dataset.tmThemeTransition).toBeUndefined();
});

function enableGlow(mask = true) {
  Object.defineProperty(window, 'CSS', {
    configurable: true,
    value: { supports: () => mask, registerProperty: jest.fn() },
  });
}

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
  '%s circular glow keeps the control centre and covers every corner before cleanup',
  async (theme) => {
    enableGlow();
    document.documentElement.className = theme === 'light' ? 'dark' : 'light';
    origin.getBoundingClientRect = () =>
      ({ left: 20, top: 30, width: 44, height: 44 } as DOMRect);
    let capturedEffect: string | undefined;
    let capturedCentre = '';
    document.startViewTransition = (update) => {
      capturedEffect = document.documentElement.dataset.tmThemeEffect;
      capturedCentre =
        document.documentElement.style.getPropertyValue('--tm-theme-x');
      return startSuccessfulTransition(update);
    };
    await changeThemeWithTransition(theme, setTheme, origin);
    expect(capturedEffect).toBe('glow');
    expect(capturedCentre).toBe('42px');
    expect(animate).toHaveBeenCalledTimes(2);
    const frames = animate.mock.calls[0][0];
    const radii = frames.map((frame) =>
      parseFloat(String(frame['--tm-theme-radius']))
    );
    const farthest = Math.hypot(
      Math.max(42, window.innerWidth - 42),
      Math.max(52, window.innerHeight - 52)
    );
    expect(theme === 'light' ? radii[0] : radii[1]).toBeLessThan(0);
    expect(theme === 'light' ? radii[1] : radii[0]).toBeGreaterThan(farthest);
    expect(animate.mock.calls[1][0]).toEqual(frames);
    expect(animate.mock.calls[0][1].pseudoElement).toBe(
      theme === 'light'
        ? '::view-transition-new(root)'
        : '::view-transition-old(root)'
    );
    for (const [, options] of animate.mock.calls)
      expect(options).toMatchObject({ duration: 500, fill: 'forwards' });
    expect(document.documentElement.dataset.tmThemeEffect).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue('--tm-theme-x')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--tm-theme-y')
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue('--tm-theme-softness')
    ).toBe('');
  }
);

test('reduced motion cancels both active circular glow layers', async () => {
  enableGlow();
  document.startViewTransition = startSuccessfulTransition;
  const first = deferred();
  const second = deferred();
  const started = deferred();
  const cancelFirst = jest.fn(first.resolve);
  const cancelSecond = jest.fn(second.resolve);
  animate.mockImplementationOnce(() => ({
    finished: first.promise,
    cancel: cancelFirst,
  }));
  animate.mockImplementationOnce(() => {
    started.resolve();
    return { finished: second.promise, cancel: cancelSecond };
  });
  const pending = changeThemeWithTransition('light', setTheme, origin);
  await started.promise;
  reduced = true;
  motionChange();
  await pending;
  expect(cancelFirst).toHaveBeenCalled();
  expect(cancelSecond).toHaveBeenCalled();
  expect(document.documentElement).toHaveClass('light');
  expect(document.documentElement.dataset.tmThemeEffect).toBeUndefined();
  expect(origin).not.toHaveAttribute('data-tm-theme-origin');
});

test('missing mask support retains the original circle without the glow enhancement', async () => {
  enableGlow(false);
  document.startViewTransition = startSuccessfulTransition;
  await changeThemeWithTransition('light', setTheme, origin);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.calls[0][0][0].clipPath).toContain('circle(0px');
  expect(document.documentElement).toHaveClass('light');
});
