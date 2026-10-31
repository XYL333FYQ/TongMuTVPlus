import { createNavigationCapture } from './navigation-capture';

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
