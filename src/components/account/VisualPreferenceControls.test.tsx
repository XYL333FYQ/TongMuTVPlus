import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import VisualPreferenceControls from '@/components/account/VisualPreferenceControls';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.tmNoBlur;
  delete document.documentElement.dataset.tmReducedMotion;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.tmNoBlur;
  delete document.documentElement.dataset.tmReducedMotion;
});

test('comfort controls stay in sync across navigation surfaces and restore after remount', () => {
  const first = render(
    <>
      <VisualPreferenceControls />
      <VisualPreferenceControls />
    </>
  );
  const controls = screen.getAllByRole('checkbox', { name: /关闭背景模糊/ });
  fireEvent.click(controls[0]);
  expect(controls[1]).toBeChecked();
  expect(document.documentElement.dataset.tmNoBlur).toBe('true');
  first.unmount();
  render(<VisualPreferenceControls />);
  expect(screen.getByRole('checkbox', { name: /关闭背景模糊/ })).toBeChecked();
  expect(document.documentElement.dataset.tmNoBlur).toBe('true');
});

test('a preference change from another tab broadcasts motion changes for banner listeners', () => {
  render(<VisualPreferenceControls />);
  const listener = jest.fn();
  window.addEventListener('tm-visual-preferences-change', listener);
  localStorage.setItem(
    'tm-visual-preferences-v1',
    JSON.stringify({ noBlur: true, reduceMotion: true })
  );
  fireEvent(
    window,
    new StorageEvent('storage', { key: 'tm-visual-preferences-v1' })
  );
  expect(screen.getByRole('checkbox', { name: /减少动态效果/ })).toBeChecked();
  expect(document.documentElement.dataset.tmReducedMotion).toBe('true');
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ detail: { noBlur: true, reduceMotion: true } })
  );
  window.removeEventListener('tm-visual-preferences-change', listener);
});
