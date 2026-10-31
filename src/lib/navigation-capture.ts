import {
  diagnosticResource,
  diagnosticRoute,
  summarizeIntervals,
} from './navigation-diagnostics';

interface Frame {
  t: number;
  dt: number;
  node: number;
  top: number | null;
  bottom: number | null;
  display: string;
  opacity: string;
  transform: string;
  safeBottom: string;
  viewportHeight: number;
  viewportTop: number;
  rootTransform: string;
  animations: string[];
}
interface Capture {
  reason: string;
  route: string;
  frames: Frame[];
}

/** Opt-in DOM/rAF observations. They are not GPU presented-frame measurements. */
export function createNavigationCapture() {
  const captures: Capture[] = [];
  const identities = new WeakMap<Element, number>();
  let nextId = 0,
    started = 0,
    previous = 0,
    raf = 0,
    stopped = false;
  let active: Capture;
  const mark = (reason: 'initial' | 'input' | 'route' | 'foreground') => {
    active = { reason, route: diagnosticRoute(location.pathname), frames: [] };
    captures.push(active);
    if (captures.length > 12) captures.shift();
    started = performance.now();
    previous = 0;
    if (!raf && !stopped) raf = requestAnimationFrame(tick);
  };
  const tick = (now: number) => {
    raf = 0;
    if (
      stopped ||
      document.hidden ||
      now - started > 1500 ||
      active.frames.length >= 300
    )
      return;
    const nav = document.querySelector('.tm-mobile-nav');
    if (nav && !identities.has(nav)) identities.set(nav, ++nextId);
    const rect = nav?.getBoundingClientRect();
    const style = nav ? getComputedStyle(nav) : null;
    const rootStyle = getComputedStyle(document.documentElement);
    active.frames.push({
      t: Math.max(0, now - started),
      dt: previous ? now - previous : 0,
      node: nav ? identities.get(nav) ?? 0 : 0,
      top: rect?.top ?? null,
      bottom: rect?.bottom ?? null,
      display: style?.display || 'missing',
      opacity: style?.opacity || '',
      transform: style?.transform || '',
      safeBottom: rootStyle.getPropertyValue('--tm-safe-bottom').trim(),
      viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      viewportTop: window.visualViewport?.offsetTop ?? 0,
      rootTransform: rootStyle.transform,
      animations:
        nav
          ?.getAnimations?.()
          .map((animation) =>
            'animationName' in animation
              ? String(animation.animationName)
              : 'transition'
          ) || [],
    });
    previous = now;
    raf = requestAnimationFrame(tick);
  };
  const input = (event: Event) => {
    if (
      event.type === 'click' &&
      active.reason === 'input' &&
      performance.now() - started < 500
    )
      return;
    if ((event.target as Element | null)?.closest?.('.tm-mobile-nav,a[href]'))
      mark('input');
  };
  const foreground = () => {
    if (!document.hidden) mark('foreground');
  };
  document.addEventListener('click', input, true);
  document.addEventListener('pointerdown', input, true);
  document.addEventListener('visibilitychange', foreground);
  mark('initial');
  return {
    mark,
    report: () => {
      const controller = navigator.serviceWorker?.controller;
      const workerPath = controller
        ? new URL(controller.scriptURL).pathname
        : '';
      return {
        schema: 1,
        measurement:
          'DOM geometry and requestAnimationFrame; not GPU presented frames; observer adds overhead',
        revision: document.documentElement.dataset.tmBuild || 'unknown',
        platform: document.documentElement.dataset.tmPlatform || 'web',
        chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown',
        shellBuild:
          navigator.userAgent.match(/TMBuild\/(\d+)/)?.[1] || 'unknown',
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio,
        },
        worker: ['/sw.js', '/push-sw.js'].includes(workerPath)
          ? workerPath
          : controller
          ? 'other'
          : 'none',
        resources: (performance.getEntriesByType?.('resource') || [])
          .map((entry) => diagnosticResource(entry.name, location.origin))
          .filter(Boolean)
          .slice(-80),
        captures: captures.map((capture) => ({
          ...capture,
          timing: summarizeIntervals(capture.frames.map((frame) => frame.dt)),
        })),
      };
    },
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('click', input, true);
      document.removeEventListener('pointerdown', input, true);
      document.removeEventListener('visibilitychange', foreground);
    },
  };
}
