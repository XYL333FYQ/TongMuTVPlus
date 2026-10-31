import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import PerfProbe, { describeStall, readPerfFlag } from './PerfProbe';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));

function memoryStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('readPerfFlag', () => {
  it('没带参数：关闭', () => {
    expect(readPerfFlag('', memoryStorage())).toBe(false);
  });
  it('?perf=1 开启，并在本次会话内保持（后续页面没带参数也开着）', () => {
    const store = memoryStorage();
    expect(readPerfFlag('?perf=1', store)).toBe(true);
    expect(readPerfFlag('', store)).toBe(true);
  });
  it('?perf=0 关闭并清除', () => {
    const store = memoryStorage();
    readPerfFlag('?perf=1', store);
    store.setItem('tongmu:nav-document-trace', 'old diagnostic');
    expect(readPerfFlag('?perf=0', store)).toBe(false);
    expect(store.getItem('tongmu:nav-document-trace')).toBeNull();
    expect(readPerfFlag('', store)).toBe(false);
  });
  it('存储不可用时只认地址里的参数', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(readPerfFlag('?perf=1', broken)).toBe(true);
    expect(readPerfFlag('', broken)).toBe(false);
  });
});

describe('describeStall', () => {
  it('写出总耗时和最耗时的脚本', () => {
    expect(
      describeStall({
        duration: 180.4,
        scripts: [
          { duration: 20, sourceURL: 'http://x/_next/static/a.js?v=1' },
          {
            duration: 140,
            sourceURL: 'http://x/_next/static/chunks/page.js?v=2',
            sourceFunctionName: 'render',
          },
        ],
      })
    ).toBe('180ms · page.js:render 140ms');
  });
  it('没有脚本时说明是样式/布局/绘制', () => {
    expect(describeStall({ duration: 90 })).toContain('样式/布局/绘制');
  });
});

describe('PerfProbe', () => {
  it('没开启时什么都不渲染', () => {
    const { container } = render(<PerfProbe />);
    expect(container).toBeEmptyDOMElement();
  });
  it('开启后显示测速条', () => {
    window.sessionStorage.setItem('tongmu:perf-probe', '1');
    const { container } = render(<PerfProbe />);
    expect(container.querySelector('.tm-perf-probe')).not.toBeNull();
  });
  it('诊断导出由用户打开，包含观察边界而不包含查询参数', () => {
    window.sessionStorage.setItem('tongmu:perf-probe', '1');
    render(<PerfProbe />);
    fireEvent.click(screen.getByRole('button', { name: '诊断记录' }));
    const record = screen.getByRole('textbox', {
      name: '诊断内容',
    }) as HTMLTextAreaElement;
    expect(record.value).toContain('not GPU presented frames');
    expect(record.value).not.toContain('perf=');
  });
});
