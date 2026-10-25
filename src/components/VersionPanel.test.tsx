import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { VersionPanel } from './VersionPanel';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

describe('project version information', () => {
  it('shows the project release record and never requests another project changelog', () => {
    render(<VersionPanel isOpen onClose={jest.fn()} />);
    expect(screen.getByText('TongMuTV Plus · 版本信息')).toBeTruthy();
    expect(screen.getByText('v0.1.0 · 2026-10-25')).toBeTruthy();
    expect(screen.getByText('新增功能')).toBeTruthy();
    expect(
      screen.getByText('新增分组功能导航和由站长控制的模块开放开关。')
    ).toBeTruthy();
    expect(screen.queryByText('暂无发布记录')).toBeNull();
    expect(document.body.textContent).not.toMatch(/MoonTV|LunaTV|上游|原项目/i);
    expect(document.querySelector('a[href*="mtvpls"]')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch a changelog when reopened', () => {
    const { rerender } = render(
      <VersionPanel isOpen={false} onClose={jest.fn()} />
    );
    rerender(<VersionPanel isOpen onClose={jest.fn()} />);
    rerender(<VersionPanel isOpen={false} onClose={jest.fn()} />);
    rerender(<VersionPanel isOpen onClose={jest.fn()} />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('links to the verified TongMuTV Plus repository in a new tab', () => {
    render(<VersionPanel isOpen onClose={jest.fn()} />);
    const link = screen.getByRole('link', {
      name: 'TongMuTV Plus 项目仓库（在新标签页打开）',
    });
    expect(link.getAttribute('href')).toBe(
      'https://github.com/XYL333FYQ/TongMuTVPlus'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('closes through its button and restores scrolling when closed', () => {
    const onClose = jest.fn();
    document.body.style.overflow = 'auto';
    const { rerender } = render(<VersionPanel isOpen onClose={onClose} />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<VersionPanel isOpen={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('auto');
    expect(screen.queryByText('TongMuTV Plus · 版本信息')).toBeNull();
    document.body.style.overflow = '';
  });

  it('keeps keyboard focus inside the panel and supports Escape', () => {
    const onClose = jest.fn();
    render(<VersionPanel isOpen onClose={onClose} />);
    const close = screen.getByRole('button', { name: '关闭' });
    const repository = screen.getByRole('link', {
      name: 'TongMuTV Plus 项目仓库（在新标签页打开）',
    });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(repository);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
