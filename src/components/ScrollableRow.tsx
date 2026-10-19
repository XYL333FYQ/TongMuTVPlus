import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { isReducedMotionSetting } from '@/lib/motion';

interface ScrollableRowProps {
  children: React.ReactNode;
  scrollDistance?: number;
  bottomPadding?: string;
}

export default function ScrollableRow({
  children,
  scrollDistance = 1000,
  bottomPadding = 'pb-12 sm:pb-14',
}: ScrollableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = containerRef.current;

      // 计算是否需要左右滚动按钮
      const threshold = 1; // 容差值，避免浮点误差
      const canScrollRight =
        scrollWidth - (scrollLeft + clientWidth) > threshold;
      const canScrollLeft = scrollLeft > threshold;

      setShowRightScroll(canScrollRight);
      setShowLeftScroll(canScrollLeft);
    }
  };

  useEffect(() => {
    // 多次延迟检查，确保内容已完全渲染
    checkScroll();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScroll);

    // 创建一个 ResizeObserver 来监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      // 延迟执行检查
      checkScroll();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [children]); // 依赖 children，当子组件变化时重新检查

  // 添加一个额外的效果来监听子组件的变化
  useEffect(() => {
    if (containerRef.current) {
      // 监听 DOM 变化
      const observer = new MutationObserver(() => {
        setTimeout(checkScroll, 100);
      });

      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });

      return () => observer.disconnect();
    }
  }, []);

  const handleScrollRightClick = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: scrollDistance,
        behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
      });
    }
  };

  const handleScrollLeftClick = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: -scrollDistance,
        behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
      });
    }
  };

  return (
    <div
      className='relative'
      onMouseEnter={() => {
        setIsHovered(true);
        // 当鼠标进入时重新检查一次
        checkScroll();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={containerRef}
        className={`flex space-x-2 sm:space-x-4 overflow-x-auto scrollbar-hide py-1 sm:py-2 ${bottomPadding} px-4 sm:px-6`}
        onScroll={checkScroll}
      >
        {children}
      </div>
      {showLeftScroll && (
        <div
          className={`hidden sm:flex absolute left-0 top-0 bottom-0 w-16 items-center justify-center z-[600] focus-within:opacity-100 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          } `}
          style={{
            background: 'transparent',
            pointerEvents: 'none', // 允许点击穿透
          }}
        >
          <div
            className='absolute inset-0 flex items-center justify-center'
            style={{
              top: '40%',
              bottom: '60%',
              left: '0',
              pointerEvents: 'auto',
            }}
          >
            <button
              aria-label='向左滚动'
              onClick={handleScrollLeftClick}
              className='w-12 h-12 bg-[var(--tm-surface-raised)] rounded-full shadow-lg flex items-center justify-center hover:bg-[var(--tm-line)] border border-[var(--tm-line)] transition-transform hover:scale-105 min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <ChevronLeft className='w-6 h-6 text-[color:var(--tm-muted)]' />
            </button>
          </div>
        </div>
      )}

      {showRightScroll && (
        <div
          className={`hidden sm:flex absolute right-0 top-0 bottom-0 w-16 items-center justify-center z-[600] focus-within:opacity-100 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          } `}
          style={{
            background: 'transparent',
            pointerEvents: 'none', // 允许点击穿透
          }}
        >
          <div
            className='absolute inset-0 flex items-center justify-center'
            style={{
              top: '40%',
              bottom: '60%',
              right: '0',
              pointerEvents: 'auto',
            }}
          >
            <button
              aria-label='向右滚动'
              onClick={handleScrollRightClick}
              className='w-12 h-12 bg-[var(--tm-surface-raised)] rounded-full shadow-lg flex items-center justify-center hover:bg-[var(--tm-line)] border border-[var(--tm-line)] transition-transform hover:scale-105 min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <ChevronRight className='w-6 h-6 text-[color:var(--tm-muted)]' />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
