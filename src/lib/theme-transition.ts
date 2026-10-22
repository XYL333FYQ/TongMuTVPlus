'use client';

import { isReducedMotionSetting } from './motion';

export type ThemeSetting = 'dark' | 'light' | 'system';
let request = 0;
let activeTransition: TMViewTransition | undefined;
let activeAnimation: Animation | undefined;
let activeReveal: Animation | undefined;
let activeOrigin: HTMLElement | undefined;

function resolvesDark(theme: ThemeSetting) {
  return (
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

function clearTransitionMarkers(root: HTMLElement) {
  delete root.dataset.tmThemeTransition;
  delete root.dataset.tmThemeTarget;
  delete root.dataset.tmThemeEffect;
  root.style.removeProperty('--tm-theme-x');
  root.style.removeProperty('--tm-theme-y');
  root.style.removeProperty('--tm-theme-softness');
  activeOrigin?.removeAttribute('data-tm-theme-origin');
  activeOrigin = undefined;
}

function applyTheme(
  theme: ThemeSetting,
  setTheme: (theme: string) => void,
  currentRequest: number
): Promise<void> {
  const root = document.documentElement;
  const dark = resolvesDark(theme);
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
  activeReveal?.cancel();
  activeTransition?.skipTransition();
  activeAnimation = undefined;
  activeReveal = undefined;
  activeTransition = undefined;
  const root = document.documentElement;
  clearTransitionMarkers(root);
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
      activeReveal?.cancel();
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
    if (
      isReducedMotionSetting() ||
      root.classList.contains(resolvesDark(theme) ? 'dark' : 'light')
    ) {
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
      root.dataset.tmThemeTarget = resolvesDark(theme) ? 'dark' : 'light';
      const glow =
        typeof CSS !== 'undefined' &&
        'registerProperty' in CSS &&
        CSS.supports(
          'mask-image',
          'radial-gradient(circle, currentColor, transparent)'
        );
      const softness = Math.max(
        18,
        Math.min(36, Math.min(window.innerWidth, window.innerHeight) * 0.03)
      );
      if (glow) {
        root.dataset.tmThemeEffect = 'glow';
        root.style.setProperty('--tm-theme-x', `${x}px`);
        root.style.setProperty('--tm-theme-y', `${y}px`);
        root.style.setProperty('--tm-theme-softness', `${softness}px`);
      }
      // 只命名本次触发控件，让图标独立交接，避免双入口重名导致快照失败。
      origin.dataset.tmThemeOrigin = 'true';
      activeOrigin = origin;
      const transition = document.startViewTransition(update);
      activeTransition = transition;
      void transition.finished.catch(() => undefined);
      void transition.updateCallbackDone.catch(() => undefined);
      await transition.ready;
      if (currentRequest !== request || isReducedMotionSetting()) return;
      const dark = root.classList.contains('dark');
      root.dataset.tmThemeTarget = dark ? 'dark' : 'light';
      // 圆心与方向沿用原圆弧，柔光额外留三倍边宽，确保结束时覆盖最远角。
      const frames: Keyframe[] = glow
        ? [
            { '--tm-theme-radius': `${-softness * 3}px` },
            { '--tm-theme-radius': `${radius + softness * 3}px` },
          ]
        : [
            { clipPath: `circle(0px at ${x}px ${y}px)` },
            { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
          ];
      if (dark) frames.reverse();
      const options: KeyframeAnimationOptions = {
        duration: 500,
        fill: 'forwards',
        easing:
          getComputedStyle(root).getPropertyValue('--tm-ease-in-out').trim() ||
          'ease-in-out',
      };
      activeAnimation = root.animate(frames, {
        ...options,
        pseudoElement: dark
          ? '::view-transition-old(root)'
          : '::view-transition-new(root)',
      });
      void activeAnimation.finished.catch(() => undefined);
      if (glow)
        activeReveal = root.animate(frames, {
          ...options,
          pseudoElement: dark
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)',
        });
      await Promise.all([activeAnimation.finished, activeReveal?.finished]);
      await transition.finished;
    } else if (document.body.animate) {
      activeAnimation = document.body.animate(
        [{ opacity: 1 }, { opacity: 0.88 }],
        { duration: 125, fill: 'forwards' }
      );
      await activeAnimation.finished;
      if (currentRequest !== request) return;
      await update();
      activeAnimation.cancel();
      activeAnimation = document.body.animate(
        [{ opacity: 0.88 }, { opacity: 1 }],
        { duration: isReducedMotionSetting() ? 0 : 125 }
      );
      await activeAnimation.finished;
    } else {
      await update();
    }
  } catch {
    // 动画失败也必须应用用户选择，过渡只是主题切换的渐进增强。
    if (!applied && currentRequest === request) setTheme(theme);
  } finally {
    observer.disconnect();
    media.removeEventListener('change', stopMovement);
    if (currentRequest === request) {
      activeAnimation?.cancel();
      activeReveal?.cancel();
      activeTransition?.skipTransition();
      activeAnimation = undefined;
      activeReveal = undefined;
      activeTransition = undefined;
      clearTransitionMarkers(root);
    }
  }
}
