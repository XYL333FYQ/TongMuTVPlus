'use client';

import { isReducedMotionSetting } from './motion';

export type ThemeSetting = 'dark' | 'light' | 'system';
let request = 0;
let activeTransition: TMViewTransition | undefined;
let activeAnimation: Animation | undefined;

function applyTheme(
  theme: ThemeSetting,
  setTheme: (theme: string) => void,
  currentRequest: number
): Promise<void> {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  return new Promise((resolve, reject) => {
    if (currentRequest !== request) {
      resolve();
      return;
    }
    const observer = new MutationObserver(check);
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error('Theme class did not update'));
    }, 1000);
    function check() {
      if (
        currentRequest !== request ||
        root.classList.contains(dark ? 'dark' : 'light')
      ) {
        observer.disconnect();
        window.clearTimeout(timeout);
        resolve();
      }
    }
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTheme(theme);
    check();
  });
}

export async function changeThemeWithTransition(
  theme: ThemeSetting,
  setTheme: (theme: string) => void,
  origin: HTMLElement
): Promise<void> {
  const currentRequest = ++request;
  activeAnimation?.cancel();
  activeTransition?.skipTransition();
  activeAnimation = undefined;
  activeTransition = undefined;
  const root = document.documentElement;
  delete root.dataset.tmThemeTransition;
  let applied = false;
  const update = async () => {
    if (currentRequest !== request) return;
    applied = true;
    await applyTheme(theme, setTheme, currentRequest);
  };
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stopMovement = () => {
    if (isReducedMotionSetting() && currentRequest === request) {
      activeAnimation?.cancel();
      activeTransition?.skipTransition();
    }
  };
  const observer = new MutationObserver(stopMovement);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-tm-reduced-motion'],
  });
  media.addEventListener('change', stopMovement);
  try {
    if (isReducedMotionSetting()) {
      await update();
      return;
    }
    if (document.startViewTransition && root.animate) {
      const rect = origin.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );
      root.dataset.tmThemeTransition = 'circle';
      const transition = document.startViewTransition(update);
      activeTransition = transition;
      void transition.finished.catch(() => undefined);
      void transition.updateCallbackDone.catch(() => undefined);
      await transition.ready;
      if (currentRequest !== request || isReducedMotionSetting()) return;
      activeAnimation = root.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        ],
        {
          duration: 500,
          easing: getComputedStyle(root)
            .getPropertyValue('--tm-ease-out')
            .trim(),
          pseudoElement: '::view-transition-new(root)',
        }
      );
      await activeAnimation.finished;
      await transition.finished;
    } else if (document.body.animate) {
      activeAnimation = document.body.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 125, fill: 'forwards' }
      );
      await activeAnimation.finished;
      if (currentRequest !== request) return;
      await update();
      activeAnimation.cancel();
      activeAnimation = document.body.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: isReducedMotionSetting() ? 0 : 125 }
      );
      await activeAnimation.finished;
    } else {
      await update();
    }
  } catch {
    // Animation failures must never prevent next-themes applying the choice.
    if (!applied && currentRequest === request) setTheme(theme);
  } finally {
    observer.disconnect();
    media.removeEventListener('change', stopMovement);
    if (currentRequest === request) {
      activeAnimation?.cancel();
      activeTransition?.skipTransition();
      activeAnimation = undefined;
      activeTransition = undefined;
      delete root.dataset.tmThemeTransition;
    }
  }
}
