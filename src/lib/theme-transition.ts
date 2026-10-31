'use client';

import { isReducedMotionSetting } from './motion';
import { getPlatform } from './platform';

export type ThemeSetting = 'dark' | 'light' | 'system';
const DEFAULT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const DEFAULT_DURATION = 520;
let request = 0;
let activeTransition: TMViewTransition | undefined;
let activeAnimation: Animation | undefined;
let activeOrigin: HTMLElement | undefined;
let activeAura: HTMLSpanElement | undefined;

function resolvesDark(theme: ThemeSetting) {
  return (
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

/**
 * 圆形过渡的两种做法：
 * - converge（收拢）：旧画面是静态截图，放在上层，被一个越缩越小的圆收回按钮，新主题从外围露出来；
 * - spread（铺开）：新画面是实时画面，放在上层，被一个越撑越大的圆从按钮铺满。
 * 实时画面套裁切在手机 GPU 上比静态截图重得多：安卓 App 里"进浅色"用铺开会卡，
 * 所以 App 里两个方向都用收拢（和一直很顺的"进深色"同一套）；网页、电脑客户端保持原来的方向。
 */
export type ThemeMotion = 'converge' | 'spread';

export function resolveThemeMotion(
  dark: boolean,
  platform: ReturnType<typeof getPlatform> = getPlatform()
): ThemeMotion {
  return dark || platform === 'app' ? 'converge' : 'spread';
}

export interface SnapshotGeometry {
  /** 控件中心，在整个过渡层（::view-transition）坐标系里：日冕环、底层缩放以它为准 */
  x: number;
  y: number;
  /** 控件中心，在根画面（::view-transition-new/old(root)）自己的坐标系里：圆形裁切以它为准 */
  localX: number;
  localY: number;
  /** 过渡层的大小 */
  width: number;
  height: number;
  /** 铺满过渡层所需的最大半径 */
  radius: number;
}

function matrixTranslate(value: string): { x: number; y: number } | null {
  // computed transform 形如 matrix(a, b, c, d, e, f)；none 表示没有平移
  if (!value || value === 'none') return { x: 0, y: 0 };
  const match = /^matrix\(([^)]+)\)$/.exec(value.trim());
  if (!match) return null;
  const parts = match[1].split(',').map((part) => parseFloat(part));
  if (parts.length !== 6 || parts.some((part) => !Number.isFinite(part)))
    return null;
  return { x: parts[4], y: parts[5] };
}

/**
 * 过渡开始后，直接问浏览器：控件那一层动画实际摆在过渡层的哪个位置。
 *
 * 以前圆心用点击时按钮在页面里的位置（getBoundingClientRect）直接当裁切坐标，
 * 默认"页面坐标系 = 过渡层坐标系"。手机浏览器的地址栏会伸缩、可视区会变，
 * 两个坐标系可能差一截，圆就从按钮上方冒出来。浏览器自己给控件那层动画算好的位置
 * 永远和画面一致，所以从它读：不用猜地址栏、缩放、弹出菜单的位置动画，哪种情况都对。
 * 读不到（浏览器不支持读伪元素样式等）就退回页面坐标。
 */
export function readSnapshotGeometry(
  root: HTMLElement,
  fallback: { x: number; y: number; width: number; height: number },
  getStyle: (
    element: Element,
    pseudo: string
  ) => Pick<CSSStyleDeclaration, 'transform' | 'width' | 'height'> = (
    element,
    pseudo
  ) => getComputedStyle(element, pseudo)
): SnapshotGeometry {
  const result = (
    x: number,
    y: number,
    localX: number,
    localY: number,
    width: number,
    height: number,
    margin: number
  ): SnapshotGeometry => ({
    x,
    y,
    localX,
    localY,
    width,
    height,
    radius:
      Math.hypot(
        Math.max(localX, width - localX),
        Math.max(localY, height - localY)
      ) + margin,
  });
  const fromLayout = () =>
    result(
      fallback.x,
      fallback.y,
      fallback.x,
      fallback.y,
      fallback.width,
      fallback.height,
      0
    );
  try {
    const layer = getStyle(root, '::view-transition');
    const rootGroup = getStyle(root, '::view-transition-group(root)');
    const control = getStyle(root, '::view-transition-group(tm-theme-control)');
    const width = parseFloat(layer.width);
    const height = parseFloat(layer.height);
    const controlAt = matrixTranslate(control.transform);
    const rootAt = matrixTranslate(rootGroup.transform);
    const controlWidth = parseFloat(control.width);
    const controlHeight = parseFloat(control.height);
    if (
      !controlAt ||
      !rootAt ||
      ![width, height, controlWidth, controlHeight].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0 ||
      controlWidth <= 0 ||
      controlHeight <= 0
    )
      return fromLayout();
    const x = controlAt.x + controlWidth / 2;
    const y = controlAt.y + controlHeight / 2;
    // 多留 2px，避免半径刚好卡在角上时露出一条缝
    return result(x, y, x - rootAt.x, y - rootAt.y, width, height, 2);
  } catch {
    return fromLayout();
  }
}

function mountThemeAura(x: number, y: number, radius: number) {
  const root = document.documentElement;
  root.style.setProperty('--tm-theme-x', `${x}px`);
  root.style.setProperty('--tm-theme-y', `${y}px`);
  root.style.setProperty('--tm-theme-r', `${radius}px`);
  if (!document.body) return;
  const aura = document.createElement('span');
  aura.setAttribute('data-tm-theme-aura', 'true');
  aura.setAttribute('aria-hidden', 'true');
  document.body.appendChild(aura);
  activeAura = aura;
}

function clearTransitionMarkers(root: HTMLElement) {
  delete root.dataset.tmThemeTransition;
  delete root.dataset.tmThemeTarget;
  delete root.dataset.tmThemeMotion;
  root.style.removeProperty('--tm-theme-x');
  root.style.removeProperty('--tm-theme-y');
  root.style.removeProperty('--tm-theme-r');
  root.style.removeProperty('--tm-theme-lx');
  root.style.removeProperty('--tm-theme-ly');
  activeOrigin?.removeAttribute('data-tm-theme-origin');
  activeOrigin = undefined;
  activeAura?.remove();
  activeAura = undefined;
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
  activeTransition?.skipTransition();
  activeAnimation = undefined;
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
      // 时长与缓动从 CSS token 读，和日冕环、底层后退、图标交接保持同频。
      const style = getComputedStyle(root);
      const easing =
        style.getPropertyValue('--tm-ease-theme').trim() || DEFAULT_EASE;
      const parsed = parseFloat(style.getPropertyValue('--tm-d-theme'));
      const duration = parsed > 0 ? parsed : DEFAULT_DURATION;
      root.dataset.tmThemeTransition = 'circle';
      root.dataset.tmThemeTarget = resolvesDark(theme) ? 'dark' : 'light';
      root.dataset.tmThemeMotion = resolveThemeMotion(resolvesDark(theme));
      // 只命名本次触发控件，让图标独立交接，避免双入口重名导致快照失败。
      origin.dataset.tmThemeOrigin = 'true';
      activeOrigin = origin;
      mountThemeAura(x, y, radius);
      const transition = document.startViewTransition(update);
      activeTransition = transition;
      void transition.finished.catch(() => undefined);
      void transition.updateCallbackDone.catch(() => undefined);
      await transition.ready;
      if (currentRequest !== request || isReducedMotionSetting()) return;
      // 过渡层已经建好：用浏览器给出的真实位置校正圆心和半径（见 readSnapshotGeometry）
      const geometry = readSnapshotGeometry(root, {
        x,
        y,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      root.style.setProperty('--tm-theme-x', `${geometry.x}px`);
      root.style.setProperty('--tm-theme-y', `${geometry.y}px`);
      root.style.setProperty('--tm-theme-lx', `${geometry.localX}px`);
      root.style.setProperty('--tm-theme-ly', `${geometry.localY}px`);
      root.style.setProperty('--tm-theme-r', `${geometry.radius}px`);
      const dark = root.classList.contains('dark');
      const converge = resolveThemeMotion(dark) === 'converge';
      root.dataset.tmThemeTarget = dark ? 'dark' : 'light';
      root.dataset.tmThemeMotion = converge ? 'converge' : 'spread';
      const frames: Keyframe[] = [
        {
          clipPath: `circle(0px at ${geometry.localX}px ${geometry.localY}px)`,
        },
        {
          clipPath: `circle(${geometry.radius}px at ${geometry.localX}px ${geometry.localY}px)`,
        },
      ];
      if (converge) frames.reverse();
      activeAnimation = root.animate(frames, {
        duration,
        fill: 'forwards',
        easing,
        pseudoElement: converge
          ? '::view-transition-old(root)'
          : '::view-transition-new(root)',
      });
      void activeAnimation.finished.catch(() => undefined);
      await activeAnimation.finished;
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
      activeTransition?.skipTransition();
      activeAnimation = undefined;
      activeTransition = undefined;
      clearTransitionMarkers(root);
    }
  }
}
