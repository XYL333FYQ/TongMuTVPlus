import { changeThemeWithTransition } from './theme-transition';

let reduced = false;
const cancel = jest.fn();
const animate = jest.fn(
  (_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({
    finished: Promise.resolve(),
    cancel,
  })
);
const origin = document.createElement('button');
const setTheme = jest.fn((theme: string) => {
  document.documentElement.className = theme;
});
beforeEach(() => {
  reduced = false;
  jest.clearAllMocks();
  document.documentElement.className = 'dark';
  delete document.documentElement.dataset.tmReducedMotion;
  delete document.startViewTransition;
  document.documentElement.style.setProperty(
    '--tm-ease-out',
    'cubic-bezier(.22,1,.36,1)'
  );
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches: reduced,
      addEventListener: jest.fn(),
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
