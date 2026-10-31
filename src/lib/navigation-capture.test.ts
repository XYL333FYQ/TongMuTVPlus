import { createNavigationCapture } from './navigation-capture';

const TRACE_KEY = 'tongmu:nav-document-trace';
const originalOrigin = Object.getOwnPropertyDescriptor(
  performance,
  'timeOrigin'
);
afterEach(() => {
  sessionStorage.clear();
  if (originalOrigin)
    Object.defineProperty(performance, 'timeOrigin', originalOrigin);
  else Reflect.deleteProperty(performance, 'timeOrigin');
});

test('records whole navigation geometry and bounds the capture history', () => {
  const nav = document.createElement('nav');
  nav.className = 'tm-mobile-nav';
  document.body.appendChild(nav);
  nav.getBoundingClientRect = () => ({ top: 700, bottom: 764 } as DOMRect);
  let callback: FrameRequestCallback = jest.fn();
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((fn) => {
      callback = fn;
      return 1;
    });
  const cancel = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(jest.fn());
  const recorder = createNavigationCapture();
  callback(performance.now());
  const report = recorder.report();
  expect(report.captures[0].frames[0].top).toBe(700);
  expect(report.captures[0].frames[0].bottom).toBe(764);
  nav.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  expect(
    recorder.report().captures.filter((item) => item.reason === 'input')
  ).toHaveLength(1);
  nav.click();
  expect(
    recorder.report().captures.filter((item) => item.reason === 'input')
  ).toHaveLength(1);
  for (let i = 0; i < 15; i++) recorder.mark('route');
  expect(recorder.report().captures.length).toBeLessThanOrEqual(12);
  recorder.stop();
  expect(cancel).toHaveBeenCalled();
  nav.remove();
  raf.mockRestore();
  cancel.mockRestore();
});

test('a full document navigation preserves a bounded privacy-safe breadcrumb', () => {
  Object.defineProperty(performance, 'timeOrigin', {
    configurable: true,
    value: 100,
  });
  const first = createNavigationCapture();
  first.mark('input');
  window.dispatchEvent(new Event('pagehide'));
  first.stop();
  Object.defineProperty(performance, 'timeOrigin', {
    configurable: true,
    value: 200,
  });
  const next = createNavigationCapture();
  const report = next.report();
  expect(report.document.startedAt).toBe(200);
  expect(report.previousDocuments).toHaveLength(1);
  expect(report.previousDocuments[0].startedAt).toBe(100);
  next.stop();
});

test('old document input is whitelisted and never exports private URL parts', () => {
  sessionStorage.setItem(
    TRACE_KEY,
    JSON.stringify([
      {
        startedAt: 10,
        route: '/watch-room/private?q=secret',
        revision: 'secret',
        navigationType: 'secret',
        captures: 2,
        frames: 3,
        privateField: 'secret',
      },
    ])
  );
  const recorder = createNavigationCapture();
  expect(recorder.report().previousDocuments[0].route).toBe('/watch-room');
  expect(JSON.stringify(recorder.report().previousDocuments)).not.toMatch(
    /private|secret/
  );
  recorder.stop();
});

test('document history is bounded and a stopped recorder cannot write later', () => {
  for (let id = 1; id <= 5; id++) {
    Object.defineProperty(performance, 'timeOrigin', {
      configurable: true,
      value: id,
    });
    const recorder = createNavigationCapture();
    window.dispatchEvent(new Event('pagehide'));
    recorder.stop();
  }
  const saved = sessionStorage.getItem(TRACE_KEY);
  expect(JSON.parse(saved || '[]')).toHaveLength(3);
  window.dispatchEvent(new Event('pagehide'));
  expect(sessionStorage.getItem(TRACE_KEY)).toBe(saved);
});

test('back-forward cache restoration is identified without claiming a new document', () => {
  const recorder = createNavigationCapture();
  const startedAt = recorder.report().document.startedAt;
  window.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: true })
  );
  expect(recorder.report().document).toMatchObject({
    startedAt,
    restoredFromBFCache: true,
  });
  expect(recorder.report().captures.slice(-1)[0].reason).toBe('foreground');
  recorder.stop();
  const count = recorder.report().captures.length;
  window.dispatchEvent(
    Object.assign(new Event('pageshow'), { persisted: true })
  );
  expect(recorder.report().captures).toHaveLength(count);
});
