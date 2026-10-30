'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const FLAG_KEY = 'tongmu:perf-probe';

interface Snapshot {
  fps: number;
  worst: number;
  slow: number;
  nav: string;
  stalls: string[];
}

/** 地址里带 ?perf=1 就开启（本次会话内一直开着），?perf=0 关闭。 */
export function readPerfFlag(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): boolean {
  const asked = new URLSearchParams(search).get('perf');
  try {
    if (asked === '1') storage.setItem(FLAG_KEY, '1');
    if (asked === '0') storage.removeItem(FLAG_KEY);
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
  });
  const clickAt = useRef(0);
  const lastPath = useRef(pathname);
  const stalls = useRef<string[]>([]);

  useEffect(() => {
    setOn(readPerfFlag(window.location.search, window.sessionStorage));
  }, []);

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
    const started = clickAt.current;
    if (!started) return;
    const urlMs = Math.round(performance.now() - started);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const paintMs = Math.round(performance.now() - started);
        setSnap((prev) => ({
          ...prev,
          nav: `${pathname}：点击→网址 ${urlMs}ms，→画面 ${paintMs}ms`,
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
      setSnap((prev) => ({
        ...prev,
        fps: lastSecond.length,
        worst: Math.round(Math.max(0, ...frames.map((frame) => frame.dt))),
        slow: frames.filter((frame) => frame.dt > 50).length,
        stalls: stalls.current,
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
    <div className='tm-perf-probe' aria-hidden='true'>
      <div>
        {snap.fps} fps · 最长帧 {snap.worst}ms · 卡顿帧 {snap.slow}
      </div>
      <div>{snap.nav}</div>
      {snap.stalls.map((line, index) => (
        <div key={index}>长帧 {line}</div>
      ))}
    </div>
  );
}
