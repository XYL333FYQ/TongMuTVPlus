'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { isReducedMotionSetting } from '@/lib/motion';

/**
 * 横向片架：卡片宽度跟随海报栅格（手机 3 列、平板 4、桌面 5–6），
 * 手指滑动带吸附；桌面悬停时两侧出现翻页按钮，一次翻一屏。
 */
export default function Shelf({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft >= max - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, children]);

  const page = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.9,
      behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
    });
  };

  return (
    <div className='tm-shelf-frame'>
      <div ref={track} className='tm-shelf' onScroll={measure}>
        {children}
      </div>
      {!edges.start && (
        <button
          type='button'
          className='tm-shelf-nav'
          data-side='start'
          aria-label='向前翻页'
          onClick={() => page(-1)}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {!edges.end && (
        <button
          type='button'
          className='tm-shelf-nav'
          data-side='end'
          aria-label='向后翻页'
          onClick={() => page(1)}
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}
