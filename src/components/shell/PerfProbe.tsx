'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  createNavigationCapture,
  NAV_DOCUMENT_TRACE_KEY,
} from '@/lib/navigation-capture';
import { summarizeIntervals } from '@/lib/navigation-diagnostics';

const FLAG_KEY = 'tongmu:perf-probe';

interface Snapshot {
  fps: number;
  worst: number;
  slow: number;
  nav: string;
  stalls: string[];
  p95: number;
  overBudget: number;
}

/** 地址里带 ?perf=1 就开启（本次会话内一直开着），?perf=0 关闭。 */
export function readPerfFlag(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): boolean {
  const asked = new URLSearchParams(search).get('perf');
  try {
    if (asked === '1') storage.setItem(FLAG_KEY, '1');
    if (asked === '0') {
      storage.removeItem(FLAG_KEY);
      storage.removeItem(NAV_DOCUMENT_TRACE_KEY);
    }
    return storage.getItem(FLAG_KEY) === '1';
  } catch {
    return asked === '1';
  }
}

/** 把一条“长动画帧”记录压成一行：总耗时 + 最耗时的脚本来源。 */
export function describeStall(entry: {
  duration: number;
  scripts?: {
    duration: number;
    sourceURL?: string;
    sourceFunctionName?: string;
  }[];
}): string {
  const top = [...(entry.scripts || [])].sort(
    (a, b) => b.duration - a.duration
  )[0];
  const where = top
    ? `${(top.sourceURL || '').split('/').pop()?.split('?')[0] || '内联'}${
        top.sourceFunctionName ? ':' + top.sourceFunctionName : ''
      } ${Math.round(top.duration)}ms`
    : '无脚本（样式/布局/绘制）';
  return `${Math.round(entry.duration)}ms · ${where}`;
}

/**
 * 卡顿测速条：只在 ?perf=1 时出现，不影响其他人。
 * 显示：帧率、最近 5 秒最长一帧、卡顿帧数、最近几次长帧的来源，
 * 以及“点击 → 网址变化 → 画面出现”的切页耗时，截图发回来就能定位卡在哪。
 */
export default function PerfProbe() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [snap, setSnap] = useState<Snapshot>({
    fps: 0,
    worst: 0,
    slow: 0,
    nav: '还没切过页',
    stalls: [],
    p95: 0,
    overBudget: 0,
  });
  const capture = useRef<ReturnType<typeof createNavigationCapture> | null>(
    null
  );
  const [exportText, setExportText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const clickAt = useRef(0);
  const lastPath = useRef(pathname);
  const stalls = useRef<string[]>([]);

  useEffect(() => {
    setOn(readPerfFlag(window.location.search, window.sessionStorage));
  }, []);

  useEffect(() => {
    if (!on) return;
    const recorder = createNavigationCapture();
    capture.current = recorder;
    return () => {
      recorder.stop();
      capture.current = null;
    };
  }, [on]);

  // 切页耗时：点击（或底栏滑动松手）→ 网址变化 → 两帧后画面出现
  useEffect(() => {
    if (!on) return;
    const mark = () => {
      clickAt.current = performance.now();
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('a[href]')) mark();
    };
    const onUp = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest?.('.tm-mobile-nav')) mark();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerup', onUp, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, [on]);

  useEffect(() => {
    if (!on || pathname === lastPath.current) return;
    lastPath.current = pathname;
    capture.current?.mark('route');
    const started = clickAt.current;
    if (!started) return;
    const urlMs = Math.round(performance.now() - started);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const paintMs = Math.round(performance.now() - started);
        setSnap((prev) => ({
          ...prev,
          nav: `${pathname
            .split('/')
            .slice(0, 2)
            .join('/')}：点击→路由 ${urlMs}ms，→回调 ${paintMs}ms`,
        }));
      })
    );
  }, [on, pathname]);

  // 帧率与长帧
  useEffect(() => {
    if (!on) return;
    let frames: { at: number; dt: number }[] = [];
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames.push({ at: now, dt: now - last });
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          stalls.current = [
            describeStall(
              entry as unknown as Parameters<typeof describeStall>[0]
            ),
            ...stalls.current,
          ].slice(0, 4);
        }
      });
      observer.observe({ type: 'long-animation-frame', buffered: false });
    } catch {
      // 旧内核没有 long-animation-frame，只显示帧率
    }

    const timer = window.setInterval(() => {
      const now = performance.now();
      frames = frames.filter((frame) => now - frame.at < 5000);
      const lastSecond = frames.filter((frame) => now - frame.at < 1000);
      const timing = summarizeIntervals(frames.map((frame) => frame.dt));
      setSnap((prev) => ({
        ...prev,
        fps: lastSecond.length,
        worst: Math.round(Math.max(0, ...frames.map((frame) => frame.dt))),
        slow: frames.filter((frame) => frame.dt > 50).length,
        stalls: stalls.current,
        p95: Math.round(timing.p95),
        overBudget: timing.overBudget,
      }));
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, [on]);

  if (!on) return null;
  return (
    <div className='tm-perf-probe' role='group' aria-label='性能诊断'>
      <div>
        {snap.fps} fps · P95 {snap.p95}ms · 最长 {snap.worst}ms · 超预算{' '}
        {snap.overBudget} · 超50ms {snap.slow}
      </div>
      <div>{snap.nav}</div>
      {snap.stalls.map((line, index) => (
        <div key={index}>长帧 {line}</div>
      ))}
      <button
        type='button'
        className='tm-btn tm-btn-secondary tm-perf-control'
        onClick={() => {
          setExportText(
            JSON.stringify(capture.current?.report() || {}, null, 2)
          );
          setCopyStatus('');
        }}
      >
        诊断记录
      </button>
      {exportText && (
        <div className='tm-perf-control'>
          <textarea
            aria-label='诊断内容'
            className='tm-input tm-selectable'
            readOnly
            value={exportText}
            rows={5}
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              className='tm-btn tm-btn-secondary'
              onClick={() => {
                if (!navigator.clipboard) {
                  setCopyStatus('请在文本框中选择并复制');
                  return;
                }
                void navigator.clipboard.writeText(exportText).then(
                  () => setCopyStatus('已复制'),
                  () => setCopyStatus('请在文本框中选择并复制')
                );
              }}
            >
              复制记录
            </button>
            <button
              type='button'
              className='tm-btn tm-btn-secondary'
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([exportText], { type: 'application/json' })
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = 'tongmu-navigation-diagnostics.json';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
              }}
            >
              下载记录
            </button>
            <button
              type='button'
              className='tm-btn tm-btn-secondary'
              onClick={() => setExportText('')}
            >
              收起记录
            </button>
          </div>
          <div role='status'>{copyStatus}</div>
        </div>
      )}
    </div>
  );
}
