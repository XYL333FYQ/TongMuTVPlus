/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import { motion } from 'framer-motion';
import React, { useId } from 'react';

import '@/styles/controls.css';

import { useReducedMotionSetting } from '@/lib/motion';

import MultiLevelSelector from './MultiLevelSelector';
import WeekdaySelector from './WeekdaySelector';

interface SelectorOption {
  label: string;
  value: string;
}

interface DoubanSelectorProps {
  type: 'movie' | 'tv' | 'show' | 'anime';
  primarySelection?: string;
  secondarySelection?: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onMultiLevelChange?: (values: Record<string, string>) => void;
  onWeekdayChange: (weekday: string) => void;
  /** 「每日放送」的展示视图：卡片网格 / 时刻表时间轴 */
  viewMode?: 'grid' | 'schedule';
  onViewModeChange?: (viewMode: 'grid' | 'schedule') => void;
}

const DoubanSelector: React.FC<DoubanSelectorProps> = ({
  type,
  primarySelection,
  secondarySelection,
  onPrimaryChange,
  onSecondaryChange,
  onMultiLevelChange,
  onWeekdayChange,
  viewMode = 'grid',
  onViewModeChange,
}) => {
  const selectionId = useId();
  const reduced = useReducedMotionSetting();

  // 电影的一级选择器选项
  const moviePrimaryOptions: SelectorOption[] = [
    { label: '综合推荐', value: '全部' },
    { label: '热门电影', value: '热门' },
    { label: '最新电影', value: '最新' },
    { label: '豆瓣高分', value: '豆瓣高分' },
    { label: '冷门佳片', value: '冷门佳片' },
  ];

  // 电影的二级选择器选项
  const movieSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '华语', value: '华语' },
    { label: '欧美', value: '欧美' },
    { label: '韩国', value: '韩国' },
    { label: '日本', value: '日本' },
  ];

  // 电视剧一级选择器选项
  const tvPrimaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '最近热门', value: '最近热门' },
  ];

  // 电视剧二级选择器选项
  const tvSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: 'tv' },
    { label: '国产', value: 'tv_domestic' },
    { label: '欧美', value: 'tv_american' },
    { label: '日本', value: 'tv_japanese' },
    { label: '韩国', value: 'tv_korean' },
    { label: '动漫', value: 'tv_animation' },
    { label: '纪录片', value: 'tv_documentary' },
  ];

  // 综艺一级选择器选项
  const showPrimaryOptions: SelectorOption[] = [
    { label: '全部', value: '全部' },
    { label: '最近热门', value: '最近热门' },
  ];

  // 综艺二级选择器选项
  const showSecondaryOptions: SelectorOption[] = [
    { label: '全部', value: 'show' },
    { label: '国内', value: 'show_domestic' },
    { label: '国外', value: 'show_foreign' },
  ];

  // 动漫一级选择器选项
  const animePrimaryOptions: SelectorOption[] = [
    { label: '每日放送', value: '每日放送' },
    { label: '番剧', value: '番剧' },
    { label: '剧场版', value: '剧场版' },
  ];

  const scheduleValue = '__schedule__';
  const animeSelectorOptions: SelectorOption[] = [
    { label: '每日放送', value: '每日放送' },
    { label: '时刻表', value: scheduleValue },
    { label: '番剧', value: '番剧' },
    { label: '剧场版', value: '剧场版' },
  ];

  // 处理多级选择器变化
  const handleMultiLevelChange = (values: Record<string, string>) => {
    onMultiLevelChange?.(values);
  };

  // 只在type变化时重新计算

  // 渲染胶囊式选择器
  const renderCapsuleSelector = (
    options: SelectorOption[],
    activeValue: string | undefined,
    onChange: (value: string) => void,
    isPrimary = false
  ) => {
    return (
      <div className='tm-capsule'>
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

  return (
    <div className='tm-filter-rows'>
      {/* 电影类型 - 显示两级选择器 */}
      {type === 'movie' && (
        <div className='tm-filter-rows'>
          {/* 一级选择器 */}
          <div className='tm-filter-row'>
            <span className='tm-filter-label'>分类</span>
            <div className='tm-filter-track'>
              {renderCapsuleSelector(
                moviePrimaryOptions,
                primarySelection || moviePrimaryOptions[0].value,
                onPrimaryChange,
                true
              )}
            </div>
          </div>

          {/* 二级选择器 - 只在非"全部"时显示 */}
          {primarySelection !== '全部' ? (
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>地区</span>
              <div className='tm-filter-track'>
                {renderCapsuleSelector(
                  movieSecondaryOptions,
                  secondarySelection || movieSecondaryOptions[0].value,
                  onSecondaryChange,
                  false
                )}
              </div>
            </div>
          ) : (
            /* 多级选择器 - 只在选中"全部"时显示 */
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>筛选</span>
              <div className='tm-filter-track'>
                <MultiLevelSelector
                  key={`${type}-${primarySelection}`}
                  onChange={handleMultiLevelChange}
                  contentType={type}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 电视剧类型 - 显示两级选择器 */}
      {type === 'tv' && (
        <div className='tm-filter-rows'>
          {/* 一级选择器 */}
          <div className='tm-filter-row'>
            <span className='tm-filter-label'>分类</span>
            <div className='tm-filter-track'>
              {renderCapsuleSelector(
                tvPrimaryOptions,
                primarySelection || tvPrimaryOptions[1].value,
                onPrimaryChange,
                true
              )}
            </div>
          </div>

          {/* 二级选择器 - 只在选中"最近热门"时显示，选中"全部"时显示多级选择器 */}
          {(primarySelection || tvPrimaryOptions[1].value) === '最近热门' ? (
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>类型</span>
              <div className='tm-filter-track'>
                {renderCapsuleSelector(
                  tvSecondaryOptions,
                  secondarySelection || tvSecondaryOptions[0].value,
                  onSecondaryChange,
                  false
                )}
              </div>
            </div>
          ) : (primarySelection || tvPrimaryOptions[1].value) === '全部' ? (
            /* 多级选择器 - 只在选中"全部"时显示 */
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>筛选</span>
              <div className='tm-filter-track'>
                <MultiLevelSelector
                  key={`${type}-${primarySelection}`}
                  onChange={handleMultiLevelChange}
                  contentType={type}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 动漫类型 - 显示一级选择器和多级选择器 */}
      {type === 'anime' && (
        <div className='tm-filter-rows'>
          <div className='tm-filter-row'>
            <span className='tm-filter-label'>分类</span>
            <div className='tm-filter-track'>
              {renderCapsuleSelector(
                animeSelectorOptions,
                primarySelection === '每日放送' && viewMode === 'schedule'
                  ? scheduleValue
                  : primarySelection || animePrimaryOptions[0].value,
                (value) => {
                  if (value === scheduleValue) {
                    onPrimaryChange('每日放送');
                    onViewModeChange?.('schedule');
                    return;
                  }
                  onPrimaryChange(value);
                  onViewModeChange?.('grid');
                },
                true
              )}
            </div>
          </div>

          {/* 筛选部分 - 根据一级选择器显示不同内容 */}
          {(primarySelection || animePrimaryOptions[0].value) === '每日放送' ? (
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>星期</span>
              <div className='tm-filter-track'>
                <WeekdaySelector onWeekdayChange={onWeekdayChange} />
              </div>
            </div>
          ) : (
            // 其他分类下显示原有的筛选功能
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>筛选</span>
              <div className='tm-filter-track'>
                {(primarySelection || animePrimaryOptions[0].value) ===
                '番剧' ? (
                  <MultiLevelSelector
                    key={`anime-tv-${primarySelection}`}
                    onChange={handleMultiLevelChange}
                    contentType='anime-tv'
                  />
                ) : (
                  <MultiLevelSelector
                    key={`anime-movie-${primarySelection}`}
                    onChange={handleMultiLevelChange}
                    contentType='anime-movie'
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 综艺类型 - 显示两级选择器 */}
      {type === 'show' && (
        <div className='tm-filter-rows'>
          {/* 一级选择器 */}
          <div className='tm-filter-row'>
            <span className='tm-filter-label'>分类</span>
            <div className='tm-filter-track'>
              {renderCapsuleSelector(
                showPrimaryOptions,
                primarySelection || showPrimaryOptions[1].value,
                onPrimaryChange,
                true
              )}
            </div>
          </div>

          {/* 二级选择器 - 只在选中"最近热门"时显示，选中"全部"时显示多级选择器 */}
          {(primarySelection || showPrimaryOptions[1].value) === '最近热门' ? (
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>类型</span>
              <div className='tm-filter-track'>
                {renderCapsuleSelector(
                  showSecondaryOptions,
                  secondarySelection || showSecondaryOptions[0].value,
                  onSecondaryChange,
                  false
                )}
              </div>
            </div>
          ) : (primarySelection || showPrimaryOptions[1].value) === '全部' ? (
            /* 多级选择器 - 只在选中"全部"时显示 */
            <div className='tm-filter-row'>
              <span className='tm-filter-label'>筛选</span>
              <div className='tm-filter-track'>
                <MultiLevelSelector
                  key={`${type}-${primarySelection}`}
                  onChange={handleMultiLevelChange}
                  contentType={type}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default DoubanSelector;
