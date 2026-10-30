'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { haptic } from '@/lib/shell-bridge';

import {
  isPrimaryNavigationActive,
  primaryNavigation,
} from '@/components/shell/TongMuNavigation';

interface MobileBottomNavProps {
  activePath?: string;
}

// 手指横向移动超过这个距离，才算“按住拖动”，否则仍是普通点按
const SCRUB_THRESHOLD = 10;

interface Thumb {
  left: number;
  width: number;
}

export default function MobileBottomNav({ activePath }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const gesture = useRef<{ id: number; startX: number; moving: boolean }>();
  const suppressClick = useRef(false);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  // 松手时要读的“当前指到哪一项”必须是即时值：页面忙（卡）时 React 还没来得及渲染，
  // 读 state 会读到旧值，导致松手不跳转。state 只负责高亮的显示。
  const hoverRef = useRef<number | null>(null);

  const current = (activePath || pathname).split('?')[0];
  const activeIndex = primaryNavigation.findIndex((item) =>
    isPrimaryNavigationActive(item.href, current)
  );

  // 滑块停在当前选中项上；窗口尺寸变化（旋转屏幕）时重新量
  const syncThumb = useCallback(() => {
    const el = itemRefs.current[activeIndex];
    setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [activeIndex]);
  useLayoutEffect(() => {
    syncThumb();
    // 底栏尺寸变化（旋转屏幕、从宽屏缩到手机宽度）时重新量
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncThumb);
      return () => window.removeEventListener('resize', syncThumb);
    }
    const observer = new ResizeObserver(() => {
      if (!gesture.current?.moving) syncThumb();
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [syncThumb, pathname]);

  const indexAt = (clientX: number) => {
    let best = 0;
    let bestDistance = Infinity;
    itemRefs.current.forEach((el, index) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };

  const finish = (navigate: boolean) => {
    const target = hoverRef.current;
    gesture.current = undefined;
    hoverRef.current = null;
    setScrubbing(false);
    setHover(null);
    if (navigate && target !== null && target !== activeIndex) {
      router.push(primaryNavigation[target].href);
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
      data-scrubbing={scrubbing || undefined}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return;
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
          setHover(index);
          haptic(6);
        }
        // 滑块跟着手指走，但不出第一项和最后一项的范围
        const first = itemRefs.current[0];
        const last = itemRefs.current[primaryNavigation.length - 1];
        const navLeft = navRef.current?.getBoundingClientRect().left ?? 0;
        if (first && last) {
          const width = first.offsetWidth;
          const left = Math.min(
            last.offsetLeft,
            Math.max(first.offsetLeft, event.clientX - navLeft - width / 2)
          );
          setThumb({ left, width });
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
        const active = index === activeIndex;
        return (
          <Link
            key={item.href}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            href={item.href}
            // 五个一级页提前取好页面和脚本，点下去不用再等服务器
            prefetch={true}
            className='tm-mobile-nav-item tm-press'
            data-active={active}
            data-hover={hover === index || undefined}
            aria-current={active ? 'page' : undefined}
            draggable={false}
          >
            <item.icon size={22} strokeWidth={active ? 2 : 1.65} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
