import { lockScroll } from './scroll-lock';

const body = document.body;

beforeEach(() => {
  body.removeAttribute('style');
  body.style.overflow = 'auto';
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
  Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
});

afterEach(() => jest.restoreAllMocks());

test('locks the page and remembers where it was', () => {
  const unlock = lockScroll();
  expect(body.style.overflow).toBe('hidden');
  expect(body.style.position).toBe('fixed');
  expect(body.style.top).toBe('-120px');
  unlock();
  expect(body.style.overflow).toBe('auto');
  expect(body.style.position).toBe('');
  expect(window.scrollTo).toHaveBeenCalledWith(0, 120);
});

test('two layers: closing the upper one keeps the page locked', () => {
  const unlockLower = lockScroll();
  const unlockUpper = lockScroll();
  unlockUpper();
  expect(body.style.overflow).toBe('hidden');
  expect(window.scrollTo).not.toHaveBeenCalled();
  unlockLower();
  expect(body.style.overflow).toBe('auto');
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
});

test('closing out of order still restores only after the last one', () => {
  const unlockLower = lockScroll();
  const unlockUpper = lockScroll();
  unlockLower();
  expect(body.style.overflow).toBe('hidden');
  unlockUpper();
  expect(body.style.overflow).toBe('auto');
});

test('calling the same unlock twice does not release someone else’s lock', () => {
  const unlockA = lockScroll();
  const unlockB = lockScroll();
  unlockA();
  unlockA();
  expect(body.style.overflow).toBe('hidden');
  unlockB();
  expect(body.style.overflow).toBe('auto');
});
