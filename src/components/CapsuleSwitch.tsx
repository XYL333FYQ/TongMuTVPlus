'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import { motion } from 'framer-motion';
import React, { useEffect, useId, useRef } from 'react';

import '@/styles/controls.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';

interface CapsuleSwitchProps {
  options: { label: string; value: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

const CapsuleSwitch: React.FC<CapsuleSwitchProps> = ({
  options,
  active,
  onChange,
  className,
}) => {
  const id = useId();
  const reduced = useReducedMotionSetting();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const activeIndex = options.findIndex((opt) => opt.value === active);
  // 选项集合变化时需要重新定位（如联动切换后默认项回到第 0 个，activeIndex 不变）
  const optionsSignature = options.map((opt) => opt.value).join(',');

  // 滑块由 layout 动画定位；这里只在需要时滚动到选中项。
  const updateIndicatorPosition = (autoScroll = false) => {
    if (
      activeIndex >= 0 &&
      buttonRefs.current[activeIndex] &&
      containerRef.current &&
      scrollContainerRef.current
    ) {
      const button = buttonRefs.current[activeIndex];
      const scrollContainer = scrollContainerRef.current;

      if (button) {
        const buttonOffsetLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;

        // 只在需要自动滚动时才执行
        if (autoScroll && !isScrollingRef.current) {
          const buttonRect = button.getBoundingClientRect();
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const isVisible =
            buttonRect.left >= scrollContainerRect.left &&
            buttonRect.right <= scrollContainerRect.right;

          if (!isVisible) {
            // 将选中项滚动到视图中心
            const scrollToPosition =
              buttonOffsetLeft -
              scrollContainer.offsetWidth / 2 +
              buttonWidth / 2;
            scrollContainer.scrollTo({
              left: scrollToPosition,
              behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
            });
          }
        }
      }
    }
  };

  // 组件挂载时立即计算初始位置并滚动到选中项
  useEffect(() => {
    const timeoutId = setTimeout(() => updateIndicatorPosition(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // 选中项或选项集合变化时，保持当前项可见。
  useEffect(() => {
    const timeoutId = setTimeout(() => updateIndicatorPosition(true), 0);
    return () => clearTimeout(timeoutId);
  }, [activeIndex, optionsSignature]);

  // 记录手动滚动，避免此时被自动滚动打断。
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      // 标记正在滚动
      isScrollingRef.current = true;

      // 清除之前的超时
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 不触发自动滚动。
      updateIndicatorPosition(false);

      // 滚动结束后重置标记
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [activeIndex]);

  // 鼠标拖动功能
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      startXRef.current = e.pageX - scrollContainer.offsetLeft;
      scrollLeftRef.current = scrollContainer.scrollLeft;
      scrollContainer.style.cursor = 'grabbing';
      scrollContainer.style.userSelect = 'none';
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      scrollContainer.style.cursor = 'grab';
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      scrollContainer.style.cursor = 'grab';
      // 短暂延迟后重置拖动标记，防止点击事件被触发
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 50);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startXRef.current) * 1.5; // 调整拖动速度

      // 如果移动距离超过5px，标记为已拖动
      if (Math.abs(walk) > 5) {
        hasDraggedRef.current = true;
      }

      scrollContainer.scrollLeft = scrollLeftRef.current - walk;
    };

    scrollContainer.style.cursor = 'grab';
    scrollContainer.addEventListener('mousedown', handleMouseDown);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    scrollContainer.addEventListener('mouseup', handleMouseUp);
    scrollContainer.addEventListener('mousemove', handleMouseMove);

    return () => {
      scrollContainer.removeEventListener('mousedown', handleMouseDown);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
      scrollContainer.removeEventListener('mouseup', handleMouseUp);
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`tm-capsule relative inline-flex rounded-full p-1 max-w-full ${
        className || ''
      }`}
    >
      {/* 可滚动容器 */}
      <div
        ref={scrollContainerRef}
        className='tm-capsule-scroll relative flex overflow-x-auto scrollbar-hide'
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {options.map((opt, index) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              type='button'
              aria-pressed={isActive}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={(e) => {
                // 如果正在拖动，阻止点击
                if (hasDraggedRef.current) {
                  e.preventDefault();
                  return;
                }
                onChange(opt.value);
              }}
              className='tm-capsule-option tm-press relative flex items-center justify-center gap-1.5 px-3 sm:px-4 rounded-full font-medium cursor-pointer whitespace-nowrap flex-shrink-0'
            >
              {isActive && (
                <motion.span
                  className='tm-control-selection'
                  layoutId={reduced ? undefined : `tm-capsule-${id}`}
                  initial={false}
                  transition={{
                    duration: reduced ? 0 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden='true'
                />
              )}
              {opt.icon && (
                <span className='tm-control-label inline-flex items-center'>
                  {opt.icon}
                </span>
              )}
              <span className='tm-control-label'>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CapsuleSwitch;
