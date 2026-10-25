/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import { motion } from 'framer-motion';
import React, { useEffect, useId, useRef } from 'react';

import '@/styles/controls.css';

import { useReducedMotionSetting } from '@/lib/motion';

interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
}

interface DoubanCustomSelectorProps {
  customCategories: CustomCategory[];
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
}

const DoubanCustomSelector: React.FC<DoubanCustomSelectorProps> = ({
  customCategories,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  const selectionId = useId();
  const reduced = useReducedMotionSetting();

  const secondaryContainerRef = useRef<HTMLDivElement>(null);

  // 二级选择器滚动容器的ref
  const secondaryScrollContainerRef = useRef<HTMLDivElement>(null);

  // 根据 customCategories 生成一级选择器选项（按 type 分组，电影优先）
  const primaryOptions = React.useMemo(() => {
    const types = Array.from(new Set(customCategories.map((cat) => cat.type)));
    // 确保电影类型排在前面
    const sortedTypes = types.sort((a, b) => {
      if (a === 'movie' && b !== 'movie') return -1;
      if (a !== 'movie' && b === 'movie') return 1;
      return 0;
    });
    return sortedTypes.map((type) => ({
      label: type === 'movie' ? '电影' : '剧集',
      value: type,
    }));
  }, [customCategories]);

  // 根据选中的一级选项生成二级选择器选项
  const secondaryOptions = React.useMemo(() => {
    if (!primarySelection) return [];
    return customCategories
      .filter((cat) => cat.type === primarySelection)
      .map((cat) => ({
        label: cat.name || cat.query,
        value: cat.query,
      }));
  }, [customCategories, primarySelection]);

  // 处理二级选择器的鼠标滚轮事件（原生 DOM 事件）
  const handleSecondaryWheel = React.useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = secondaryScrollContainerRef.current;
    if (container) {
      const scrollAmount = e.deltaY * 2;
      container.scrollLeft += scrollAmount;
    }
  }, []);

  // 添加二级选择器的鼠标滚轮事件监听器
  useEffect(() => {
    const scrollContainer = secondaryScrollContainerRef.current;
    const capsuleContainer = secondaryContainerRef.current;

    if (scrollContainer && capsuleContainer) {
      // 同时监听滚动容器和胶囊容器的滚轮事件
      scrollContainer.addEventListener('wheel', handleSecondaryWheel, {
        passive: false,
      });
      capsuleContainer.addEventListener('wheel', handleSecondaryWheel, {
        passive: false,
      });

      return () => {
        scrollContainer.removeEventListener('wheel', handleSecondaryWheel);
        capsuleContainer.removeEventListener('wheel', handleSecondaryWheel);
      };
    }
  }, [handleSecondaryWheel]);

  // 当二级选项变化时重新添加事件监听器
  useEffect(() => {
    const scrollContainer = secondaryScrollContainerRef.current;
    const capsuleContainer = secondaryContainerRef.current;

    if (scrollContainer && capsuleContainer && secondaryOptions.length > 0) {
      // 重新添加事件监听器
      scrollContainer.addEventListener('wheel', handleSecondaryWheel, {
        passive: false,
      });
      capsuleContainer.addEventListener('wheel', handleSecondaryWheel, {
        passive: false,
      });

      return () => {
        scrollContainer.removeEventListener('wheel', handleSecondaryWheel);
        capsuleContainer.removeEventListener('wheel', handleSecondaryWheel);
      };
    }
  }, [handleSecondaryWheel, secondaryOptions]);

  // 当选项变化时重新计算

  // 渲染胶囊式选择器
  const renderCapsuleSelector = (
    options: { label: string; value: string }[],
    activeValue: string | undefined,
    onChange: (value: string) => void,
    isPrimary = false
  ) => {
    return (
      <div
        ref={isPrimary ? undefined : secondaryContainerRef}
        className='tm-capsule tm-capsule-track'
      >
        {/* 滑动的白色背景指示器 */}

        {options.map((option) => {
          const isActive = activeValue === option.value;
          return (
            <button
              type='button'
              aria-pressed={isActive}
              key={option.value}
              onClick={() => onChange(option.value)}
              className='tm-capsule-option'
            >
              {isActive && (
                <motion.span
                  className='tm-control-selection'
                  layoutId={
                    reduced
                      ? undefined
                      : `tm-catalog-${selectionId}-${
                          isPrimary ? 'primary' : 'secondary'
                        }`
                  }
                  initial={false}
                  transition={{
                    duration: reduced ? 0 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden='true'
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    );
  };

  // 如果没有自定义分类，则不渲染任何内容
  if (!customCategories || customCategories.length === 0) {
    return null;
  }

  return (
    <div className='tm-filter-rows'>
      {/* 两级选择器包装 */}
      <div className='tm-filter-rows'>
        {/* 一级选择器 */}
        <div className='tm-filter-row'>
          <span className='tm-filter-label'>类型</span>
          <div className='tm-filter-track'>
            {renderCapsuleSelector(
              primaryOptions,
              primarySelection || primaryOptions[0]?.value,
              onPrimaryChange,
              true
            )}
          </div>
        </div>

        {/* 二级选择器 */}
        {secondaryOptions.length > 0 && (
          <div className='tm-filter-row'>
            <span className='tm-filter-label'>片单</span>
            <div ref={secondaryScrollContainerRef} className='tm-filter-track'>
              {renderCapsuleSelector(
                secondaryOptions,
                secondarySelection || secondaryOptions[0]?.value,
                onSecondaryChange,
                false
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoubanCustomSelector;
