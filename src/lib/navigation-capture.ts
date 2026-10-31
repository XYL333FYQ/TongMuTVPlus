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

export const NAV_DOCUMENT_TRACE_KEY = 'tongmu:nav-document-trace';
const NAVIGATION_TYPES = ['navigate', 'reload', 'back_forward', 'prerender'];
interface DocumentSummary {
  startedAt: number;
  route: string;
  revision: string;
  navigationType: string;
  captures: number;
  frames: number;
  lastTop: number | null;
  suspended: boolean;
}

/** Read a tiny whitelist, never a previously serialized whole report or URL. */
function previousDocuments(): DocumentSummary[] {
  try {
    const raw = sessionStorage.getItem(NAV_DOCUMENT_TRACE_KEY);
    if (!raw || raw.length > 12_000) return [];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved.slice(-3).flatMap((value: unknown) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Record<string, unknown>;
      if (
        typeof item.startedAt !== 'number' ||
        !Number.isFinite(item.startedAt) ||
        typeof item.route !== 'string'
      )
        return [];
      const count = (field: string, max: number) => {
        const value = item[field];
        return typeof value === 'number' && Number.isFinite(value)
          ? Math.max(0, Math.min(max, Math.floor(value)))
          : 0;
      };
      return [
        {
          startedAt: item.startedAt,
          route: diagnosticRoute(item.route),
          revision:
            typeof item.revision === 'string' &&
            /^(?:[a-f0-9]{7,40}|local|unknown)$/.test(item.revision)
              ? item.revision
              : 'unknown',
          navigationType:
            typeof item.navigationType === 'string' &&
            NAVIGATION_TYPES.includes(item.navigationType)
              ? item.navigationType
              : 'unknown',
          captures: count('captures', 12),
          frames: count('frames', 3600),
          lastTop:
            typeof item.lastTop === 'number' && Number.isFinite(item.lastTop)
              ? item.lastTop
              : null,
          suspended: item.suspended === true,
        },
      ];
    });
  } catch {
    return [];
  }
}

/** Opt-in DOM/rAF observations. They are not GPU presented-frame measurements. */
export function createNavigationCapture() {
  const documentStart = performance.timeOrigin || 0;
  const navigation = performance.getEntriesByType?.('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const navigationType =
    navigation && NAVIGATION_TYPES.includes(navigation.type)
      ? navigation.type
      : 'unknown';
  const entryRoute = diagnosticRoute(location.pathname);
  let restoredFromBFCache = false;
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
  const pageHide = (event: PageTransitionEvent) => {
    const lastFrames = captures[captures.length - 1]?.frames || [];
    const summary: DocumentSummary = {
      startedAt: documentStart,
      route: diagnosticRoute(location.pathname),
      revision: document.documentElement.dataset.tmBuild || 'unknown',
      navigationType,
      captures: captures.length,
      frames: captures.reduce((sum, capture) => sum + capture.frames.length, 0),
      lastTop: lastFrames[lastFrames.length - 1]?.top ?? null,
      suspended: event.persisted === true,
    };
    try {
      const trail = previousDocuments().filter(
        (item) => item.startedAt !== documentStart
      );
      sessionStorage.setItem(
        NAV_DOCUMENT_TRACE_KEY,
        JSON.stringify([...trail, summary].slice(-3))
      );
    } catch {
      /* Optional local diagnostic storage can be denied or full. */
    }
  };
  const pageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    restoredFromBFCache = true;
    mark('foreground');
  };
  document.addEventListener('click', input, true);
  document.addEventListener('pointerdown', input, true);
  document.addEventListener('visibilitychange', foreground);
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('pageshow', pageShow);
  mark('initial');
  return {
    mark,
    report: () => {
      const controller = navigator.serviceWorker?.controller;
      const workerPath = controller
        ? new URL(controller.scriptURL).pathname
        : '';
      return {
        schema: 2,
        measurement:
          'DOM geometry and requestAnimationFrame; not GPU presented frames; observer adds overhead',
        revision: document.documentElement.dataset.tmBuild || 'unknown',
        document: {
          startedAt: documentStart,
          navigationType,
          entryRoute,
          restoredFromBFCache,
        },
        previousDocuments: previousDocuments().filter(
          (item) => item.startedAt !== documentStart
        ),
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
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', pageShow);
    },
  };
}
