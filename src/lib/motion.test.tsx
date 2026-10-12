import { act, cleanup, render, screen } from '@testing-library/react';

import { useReducedMotionSetting } from './motion';

let systemReduced = false;
const listeners = new Set<() => void>();
function Probe() {
  return <output>{String(useReducedMotionSetting())}</output>;
}
beforeEach(() => {
  systemReduced = false;
  listeners.clear();
  delete document.documentElement.dataset.tmReducedMotion;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      get matches() {
        return systemReduced;
      },
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    })),
  });
});
afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.tmReducedMotion;
});
test('reacts to HTML and system preferences; either may reduce motion', async () => {
  render(<Probe />);
  expect(screen.getByRole('status')).toHaveTextContent('false');
  await act(async () => {
    document.documentElement.dataset.tmReducedMotion = 'true';
  });
  expect(screen.getByRole('status')).toHaveTextContent('true');
  act(() => {
    systemReduced = true;
    listeners.forEach((listener) => listener());
  });
  await act(async () => {
    document.documentElement.dataset.tmReducedMotion = 'false';
  });
  expect(screen.getByRole('status')).toHaveTextContent('true');
  act(() => {
    systemReduced = false;
    listeners.forEach((listener) => listener());
  });
  expect(screen.getByRole('status')).toHaveTextContent('false');
  cleanup();
  expect(listeners.size).toBe(0);
});
