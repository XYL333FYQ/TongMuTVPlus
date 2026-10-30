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
    JSON.stringify({ noBlur: true, reduceMotion: true, playerEase: false })
  );
  fireEvent(
    window,
    new StorageEvent('storage', { key: 'tm-visual-preferences-v1' })
  );
  expect(screen.getByRole('checkbox', { name: /减少动态效果/ })).toBeChecked();
  expect(document.documentElement.dataset.tmReducedMotion).toBe('true');
  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: { noBlur: true, reduceMotion: true, playerEase: false },
    })
  );
  window.removeEventListener('tm-visual-preferences-change', listener);
});

describe('手机 App 壳里模糊默认关闭', () => {
  afterEach(() => {
    delete window.TMShell;
  });

  test('没设置过：壳里默认关闭模糊，普通浏览器默认开启', () => {
    window.TMShell = {};
    const inShell = render(<VisualPreferenceControls />);
    expect(
      screen.getByRole('checkbox', { name: /关闭背景模糊/ })
    ).toBeChecked();
    expect(document.documentElement.dataset.tmNoBlur).toBe('true');
    inShell.unmount();

    delete window.TMShell;
    render(<VisualPreferenceControls />);
    expect(
      screen.getByRole('checkbox', { name: /关闭背景模糊/ })
    ).not.toBeChecked();
    expect(document.documentElement.dataset.tmNoBlur).toBe('false');
  });

  test('用户明确打开过模糊：壳里也按用户的来', () => {
    window.TMShell = {};
    localStorage.setItem(
      'tm-visual-preferences-v1',
      JSON.stringify({ noBlur: false, reduceMotion: false, playerEase: false })
    );
    render(<VisualPreferenceControls />);
    expect(
      screen.getByRole('checkbox', { name: /关闭背景模糊/ })
    ).not.toBeChecked();
    expect(document.documentElement.dataset.tmNoBlur).toBe('false');
  });
});

test('player ease is off by default and can be switched on', () => {
  delete document.documentElement.dataset.tmPlayerEase;
  render(<VisualPreferenceControls />);
  const ease = screen.getByRole('checkbox', { name: /播放窗口缓动跟随/ });
  expect(ease).not.toBeChecked();
  expect(document.documentElement.dataset.tmPlayerEase).toBe('false');
  fireEvent.click(ease);
  expect(document.documentElement.dataset.tmPlayerEase).toBe('true');
  delete document.documentElement.dataset.tmPlayerEase;
});
