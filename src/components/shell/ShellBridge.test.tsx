import { act, cleanup, render } from '@testing-library/react';

import ShellBridge from './ShellBridge';

// MutationObserver 的回调是微任务：等一轮让它跑完
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

function installShell() {
  const shell = {
    ready: jest.fn(),
    setSystemBars: jest.fn(),
    setPlaying: jest.fn(),
  };
  window.TMShell = shell;
  return shell;
}

afterEach(() => {
  cleanup();
  delete window.TMShell;
  const root = document.documentElement;
  root.className = '';
  root.removeAttribute('data-tm-theme-transition');
  jest.useRealTimers();
});

describe('ShellBridge 系统栏通知', () => {
  it('浏览器里没有壳，什么都不做', () => {
    expect(() => render(<ShellBridge />)).not.toThrow();
  });

  it('启动时告诉壳当前深浅，没有过渡时主题一变就立刻通知', async () => {
    const shell = installShell();
    document.documentElement.className = 'dark';
    render(<ShellBridge />);
    expect(shell.ready).toHaveBeenCalledTimes(1);
    expect(shell.setSystemBars).toHaveBeenLastCalledWith(true);

    document.documentElement.className = 'light';
    await flush();
    expect(shell.setSystemBars).toHaveBeenLastCalledWith(false);
  });

  it('圆形过渡进行中先不通知，过渡标记清掉后再发最终主题', async () => {
    const shell = installShell();
    const root = document.documentElement;
    root.className = 'dark';
    render(<ShellBridge />);
    shell.setSystemBars.mockClear();

    // 过渡开始（标记先于主题类名出现，和 theme-transition.ts 的顺序一致）
    root.setAttribute('data-tm-theme-transition', 'circle');
    root.className = 'light';
    await flush();
    expect(shell.setSystemBars).not.toHaveBeenCalled();

    // 过渡收尾
    root.removeAttribute('data-tm-theme-transition');
    await flush();
    expect(shell.setSystemBars).toHaveBeenCalledTimes(1);
    expect(shell.setSystemBars).toHaveBeenLastCalledWith(false);
  });

  it('过渡标记一直没清掉时，兜底计时器也会把最终主题告诉壳', async () => {
    jest.useFakeTimers();
    const shell = installShell();
    const root = document.documentElement;
    root.className = 'dark';
    render(<ShellBridge />);
    shell.setSystemBars.mockClear();

    root.setAttribute('data-tm-theme-transition', 'circle');
    root.className = 'light';
    await flush();
    expect(shell.setSystemBars).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1600);
    });
    expect(shell.setSystemBars).toHaveBeenCalledTimes(1);
    expect(shell.setSystemBars).toHaveBeenLastCalledWith(false);
  });

  it('卸载后不再通知', async () => {
    const shell = installShell();
    const root = document.documentElement;
    root.className = 'dark';
    const { unmount } = render(<ShellBridge />);
    unmount();
    shell.setSystemBars.mockClear();

    root.className = 'light';
    await flush();
    expect(shell.setSystemBars).not.toHaveBeenCalled();
  });
});
