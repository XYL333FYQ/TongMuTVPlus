'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { haptic } from '@/lib/shell-bridge';
import { prepareTabNavigation } from '@/lib/tab-memory';
import { useRememberedTabHref } from '@/hooks/useRememberedTabHref';

import {
  isPrimaryNavigationActive,
  primaryNavigation,
} from '@/components/shell/TongMuNavigation';

import {
  type Thumb,
  pinThumb,
  retargetThumb,
  thumbNow,
} from './mobileNavThumb';

interface MobileBottomNavProps {
  activePath?: string;
}

// 手指横向移动超过这个距离，才算“按住拖动”，否则仍是普通点按
const SCRUB_THRESHOLD = 10;
// 点了某一项但页面迟迟没到（网络断了、跳转被拦下）时，滑块等这么久就退回真实所在页
const PENDING_TIMEOUT = 6000;

export default function MobileBottomNav({ activePath }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const tabHref = useRememberedTabHref();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const gesture = useRef<{ id: number; startX: number; moving: boolean }>();
  const suppressClick = useRef(false);
  const geometry = useRef<{
    navLeft: number;
    items: { left: number; width: number }[];
  }>();
  const dragFrame = useRef(0);
  const dragPaint = useRef<{ thumb: Thumb; index: number }>();
  const [thumb, setThumb] = useState<Thumb | null>(() => thumbNow());
  const [scrubbing, setScrubbing] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  // 松手时要读的“当前指到哪一项”必须是即时值：页面忙（卡）时 React 还没来得及渲染，
  // 读 state 会读到旧值，导致松手不跳转。state 只负责高亮的显示。
  const hoverRef = useRef<number | null>(null);

  const current = (activePath || pathname).split('?')[0];
  const activeIndex = primaryNavigation.findIndex((item) =>
    isPrimaryNavigationActive(item.href, current)
  );

  // 点下去的那一刻，滑块和高亮就先动起来，不等新页面渲染完：
  // 新页面渲染会占住主线程几十毫秒，要是滑块等到那之后才起步，点击后会先"卡一下"再滑。
  // 滑块沿用 transform 过渡；实际呈现仍受主线程、绘制及设备 GPU 影响。
  const [pending, setPending] = useState<number | null>(null);
  const shownIndex = pending ?? activeIndex;
  // 路由真的换了：真实位置追上来，临时的"将要去"不再需要
  useEffect(() => {
    setPending(null);
  }, [pathname]);
  useEffect(() => {
    if (pending === null) return;
    const timer = window.setTimeout(() => setPending(null), PENDING_TIMEOUT);
    return () => window.clearTimeout(timer);
  }, [pending]);

  // Read together at layout/gesture boundaries, never between pointer writes.
  const measureNav = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const navLeft = nav.getBoundingClientRect().left;
    const items = itemRefs.current.map((item) => ({
      left: item?.offsetLeft || 0,
      width: item?.offsetWidth || 0,
    }));
    geometry.current = { navLeft, items };
  }, []);

  const cancelDragPaint = useCallback(() => {
    if (dragFrame.current) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    dragPaint.current = undefined;
  }, []);
  useEffect(() => cancelDragPaint, [cancelDragPaint]);
  useLayoutEffect(() => {
    cancelDragPaint();
    gesture.current = undefined;
    hoverRef.current = null;
    setScrubbing(false);
    setHover(null);
  }, [pathname, cancelDragPaint]);

  // 滑块停在当前选中项上；窗口尺寸变化（旋转屏幕）时重新量
  const syncThumb = useCallback(() => {
    const item = geometry.current?.items[shownIndex];
    // 底栏被隐藏（当前页面不需要底栏）时量不到宽度，等它显示出来（尺寸变化）再定位，避免滑块从 0 滑出
    const next =
      item && item.width > 0 ? { left: item.left, width: item.width } : null;
    retargetThumb(next);
    setThumb((current) =>
      current?.left === next?.left && current?.width === next?.width
        ? current
        : next
    );
  }, [shownIndex]);
  useLayoutEffect(() => {
    measureNav();
    syncThumb();
    // 底栏尺寸变化（旋转屏幕、从宽屏缩到手机宽度）时重新量
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') {
      const resized = () => {
        measureNav();
        syncThumb();
      };
      window.addEventListener('resize', resized);
      return () => window.removeEventListener('resize', resized);
    }
    const observer = new ResizeObserver(() => {
      measureNav();
      if (!gesture.current?.moving) syncThumb();
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measureNav, syncThumb, pathname]);

  const indexAt = (clientX: number) => {
    let best = 0;
    let bestDistance = Infinity;
    const cached = geometry.current;
    cached?.items.forEach((item, index) => {
      if (!item.width) return;
      const distance = Math.abs(
        clientX - (cached.navLeft + item.left + item.width / 2)
      );
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };

  const finish = (navigate: boolean) => {
    cancelDragPaint();
    const target = hoverRef.current;
    gesture.current = undefined;
    hoverRef.current = null;
    setScrubbing(false);
    setHover(null);
    if (navigate && target !== null && target !== shownIndex) {
      setPending(target === activeIndex ? null : target);
      router.push(prepareTabNavigation(primaryNavigation[target].href));
    } else {
      syncThumb();
    }
  };

  if (pathname === '/watch-room/screen') return null;

  return (
    <nav
      ref={navRef}
      className='tm-mobile-nav tm-glass md:hidden'
      aria-label='主导航'
      data-thumb={thumb ? 'true' : undefined}
      // 当前就在底栏上的某一页：不管页面此刻处在加载占位还是别的过渡状态，底栏都保持显示
      data-tab-route={activeIndex >= 0 ? 'true' : undefined}
      data-scrubbing={scrubbing || undefined}
      onPointerDown={(event) => {
        // A new press is a new interaction. Some engines emit no compatibility
        // click after captured drags, so the old suppression must not leak.
        suppressClick.current = false;
        if (event.pointerType === 'mouse') return;
        measureNav();
        gesture.current = {
          id: event.pointerId,
          startX: event.clientX,
          moving: false,
        };
      }}
      onPointerMove={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        if (!g.moving) {
          if (Math.abs(event.clientX - g.startX) < SCRUB_THRESHOLD) return;
          g.moving = true;
          try {
            navRef.current?.setPointerCapture(event.pointerId);
          } catch {
            // 个别环境不支持指针捕获，拖动仍按本元素内的事件工作
          }
          setScrubbing(true);
        }
        const index = indexAt(event.clientX);
        if (index !== hoverRef.current) {
          hoverRef.current = index;
          haptic(6);
        }
        // 滑块跟着手指走，但不出第一项和最后一项的范围
        const cached = geometry.current;
        const first = cached?.items[0];
        const last = cached?.items[primaryNavigation.length - 1];
        if (cached && first?.width && last?.width) {
          const width = first.width;
          const left = Math.min(
            last.left,
            Math.max(first.left, event.clientX - cached.navLeft - width / 2)
          );
          dragPaint.current = { thumb: { left, width }, index };
          if (!dragFrame.current) {
            dragFrame.current = requestAnimationFrame(() => {
              dragFrame.current = 0;
              const paint = dragPaint.current;
              dragPaint.current = undefined;
              if (!paint || !gesture.current?.moving) return;
              pinThumb(paint.thumb);
              setThumb(paint.thumb);
              setHover(paint.index);
            });
          }
        }
      }}
      onPointerUp={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        if (g.moving) {
          suppressClick.current = true;
          finish(true);
        } else {
          gesture.current = undefined;
        }
      }}
      onPointerCancel={() => {
        if (gesture.current?.moving) finish(false);
        gesture.current = undefined;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          // Keyboard/assistive activation has no preceding pointerdown.
          if (event.detail === 0) return;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {thumb && (
        <span
          className='tm-mobile-nav-thumb'
          aria-hidden='true'
          style={{
            width: thumb.width,
            transform: `translateX(${thumb.left}px)`,
          }}
        />
      )}
      {primaryNavigation.map((item, index) => {
        // 高亮跟着"将要去的那一项"走；读屏软件认的当前页（aria-current）仍以真实路由为准
        const active = index === shownIndex;
        return (
          <Link
            key={item.href}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            href={tabHref(item.href)}
            data-tm-tab-link=''
            // 五个一级页提前取好页面和脚本，点下去不用再等服务器
            prefetch={true}
            className='tm-mobile-nav-item tm-press'
            data-active={active}
            data-hover={hover === index || undefined}
            aria-current={index === activeIndex ? 'page' : undefined}
            draggable={false}
            onClick={(event) => {
              // 新标签页打开、中键等不是"在本页切换"，滑块不动
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              if (index !== shownIndex) setPending(index);
            }}
          >
            <item.icon size={22} strokeWidth={active ? 2 : 1.65} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
