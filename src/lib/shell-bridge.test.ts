import { closeTopLayer, getShell, haptic } from './shell-bridge';

afterEach(() => {
  delete window.TMShell;
  document.body.innerHTML = '';
});

describe('shell-bridge', () => {
  it('浏览器里没有壳：getShell 为空，haptic 安静跳过', () => {
    expect(getShell()).toBeUndefined();
    expect(() => haptic()).not.toThrow();
  });

  it('壳里 haptic 走壳的原生振动', () => {
    const shellHaptic = jest.fn();
    window.TMShell = { haptic: shellHaptic };
    haptic(12);
    expect(shellHaptic).toHaveBeenCalledWith(12);
  });

  it('旧壳没有 haptic 方法时不报错', () => {
    window.TMShell = {};
    expect(() => haptic()).not.toThrow();
  });

  it('没有弹层时 closeTopLayer 返回 false，交给浏览器后退', () => {
    expect(closeTopLayer()).toBe(false);
  });

  it('弹层响应 Escape 被关掉时返回 true', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') dialog.remove();
    });
    expect(closeTopLayer()).toBe(true);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('弹层不响应 Escape 时返回 false，返回键不会被吞掉', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    expect(closeTopLayer()).toBe(false);
  });

  it('native dialog receives cancel and consumes return during an asynchronous exit', () => {
    document.body.innerHTML = '<dialog open><button>关闭</button></dialog>';
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const cancel = jest.fn((event: Event) => event.preventDefault());
    dialog.addEventListener('cancel', cancel);
    expect(closeTopLayer()).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(true);
  });

  it('a legacy Escape handler can consume return before React removes the panel', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    dialog.addEventListener('keydown', (event) => event.preventDefault());
    expect(closeTopLayer()).toBe(true);
    expect(dialog.isConnected).toBe(true);
  });

  it('closes a focused menu before its containing native dialog', () => {
    document.body.innerHTML =
      '<dialog open><div role="menu"><button role="menuitem">操作</button></div></dialog>';
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    const cancel = jest.fn((event: Event) => event.preventDefault());
    dialog.addEventListener('cancel', cancel);
    menu.addEventListener('keydown', (event) => {
      event.preventDefault();
      menu.remove();
    });
    document.querySelector('button')?.focus();
    expect(closeTopLayer()).toBe(true);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });
});
